"""Rule-based action suggestion engine.

Translates the 4-horizon glucose forecast + current metabolic state (IOB,
COB, ICR, CF) into at most one prioritised ActionSuggestion.

Clinical thresholds
-------------------
LOW_THRESHOLD      70 mg/dL   — hypo boundary
HIGH_THRESHOLD    180 mg/dL   — hyper boundary
CORRECTION_TARGET 120 mg/dL   — midpoint used for correction calculations
COB_GATE_G         15 g       — suppress hyper correction when carbs still absorbing
MIN_IOB_WARN        0.5 u     — IOB level that warrants a hypo warning on falling trend
MIN_NET_CORRECTION  0.5 u     — don't surface a correction smaller than this

Correction formula (IOB-adjusted):
  gross_units = (forecast_peak − CORRECTION_TARGET) / CF
  net_units   = max(0, gross_units − IOB)   ← never stack on active insulin
  round net to nearest 0.5 u

Carb-treat formula:
  carb_sensitivity = CF / ICR   (mg/dL per gram)
  carbs_g          = ceil((target − forecast_min) / carb_sensitivity) rounded up to 5 g
"""

from __future__ import annotations

import math

from app.schemas.forecast import ActionSuggestion, HorizonForecast

# ── Clinical constants ────────────────────────────────────────────────────────
LOW_THRESHOLD = 70
HIGH_THRESHOLD = 180
CORRECTION_TARGET = 120
COB_GATE_G = 15
MIN_IOB_WARN = 0.5
MIN_NET_CORRECTION = 0.5

TREND_FALLING = {"↓↓", "↓", "↘"}

_DISCLAIMER = "Decision-support only — always follow guidance from your healthcare team."


# ── Helpers ───────────────────────────────────────────────────────────────────

def _round_carbs(g: float) -> int:
    """Round up to nearest 5 g, minimum 5 g."""
    return max(5, math.ceil(g / 5) * 5)


def _round_units(u: float) -> float:
    """Round to nearest 0.5 unit."""
    return round(u * 2) / 2


# ── Public API ────────────────────────────────────────────────────────────────

def compute_suggestions(
    forecasts: list[HorizonForecast],
    iob: float,
    cob: float,
    current_glucose: float | None,
    trend_arrow: str | None,
    block_icr: float | None,
    block_cf: float | None,
) -> list[ActionSuggestion]:
    """Return at most one prioritised ActionSuggestion.

    Returns an empty list when the model is not trained (empty forecasts).
    """
    if not forecasts:
        return []

    predicted = [f.predicted_mg_dl for f in forecasts]
    min_val = min(predicted)
    max_val = max(predicted)
    min_h = min((f for f in forecasts if f.predicted_mg_dl == min_val), key=lambda f: f.horizon_min)
    max_h = max((f for f in forecasts if f.predicted_mg_dl == max_val), key=lambda f: f.horizon_min)
    max_horizon = max(f.horizon_min for f in forecasts)

    falling = trend_arrow in TREND_FALLING

    # ── 1. Hypo imminent ──────────────────────────────────────────────────────
    if min_val < LOW_THRESHOLD:
        gap = (LOW_THRESHOLD + 5) - min_val  # aim 5 mg/dL above threshold
        if block_cf and block_icr and block_icr > 0:
            carb_sensitivity = block_cf / block_icr
            carbs = _round_carbs(gap / carb_sensitivity) if carb_sensitivity > 0 else 15
            msg = f"Take ~{carbs} g fast carbs"
            detail = (
                f"Forecast {round(min_val)} mg/dL at {min_h.horizon_min} min. "
                f"Active IOB: {iob:.1f} u. "
                f"CF {round(block_cf)} mg/dL/u ÷ ICR {round(block_icr)} g/u."
            )
        else:
            carbs = 15  # safe default
            msg = f"Take ~{carbs} g fast carbs"
            detail = (
                f"Forecast {round(min_val)} mg/dL at {min_h.horizon_min} min. "
                "CF/ICR insufficient for a precise dose — use your usual hypo treatment."
            )
        urgency = "critical" if min_val < 60 else "high"  # noqa: PLR2004
        return [ActionSuggestion(
            type="hypo_treat",
            urgency=urgency,
            message=msg,
            detail=detail,
            disclaimer=_DISCLAIMER,
        )]

    # ── 2. IOB-driven hypo risk ───────────────────────────────────────────────
    if (
        iob > MIN_IOB_WARN
        and falling
        and current_glucose is not None
        and current_glucose < 120  # noqa: PLR2004
        and cob <= 5  # noqa: PLR2004
    ):
        if block_cf and block_icr and block_icr > 0:
            carb_sensitivity = block_cf / block_icr
            protective = _round_carbs((iob * block_cf * 0.6) / carb_sensitivity)
            msg = f"IOB may push glucose lower — consider ~{protective} g carbs"
        else:
            msg = "Active IOB with falling trend — monitor closely"
        detail = (
            f"Current: {round(current_glucose)} mg/dL (falling). "
            f"Active IOB: {iob:.1f} u may drive glucose below range."
        )
        return [ActionSuggestion(
            type="hypo_warn",
            urgency="moderate",
            message=msg,
            detail=detail,
            disclaimer=_DISCLAIMER,
        )]

    # ── 3. Hyper ──────────────────────────────────────────────────────────────
    if max_val > HIGH_THRESHOLD:
        if cob > COB_GATE_G:
            return [ActionSuggestion(
                type="hyper_warn",
                urgency="moderate",
                message="Glucose rising — active carbs still absorbing",
                detail=(
                    f"Forecast peaks at {round(max_val)} mg/dL at {max_h.horizon_min} min. "
                    f"~{round(cob)} g carbs still absorbing. Hold correction for now."
                ),
                disclaimer=_DISCLAIMER,
            )]

        if block_cf and block_cf > 0:
            gross = (max_val - CORRECTION_TARGET) / block_cf
            net = _round_units(max(0.0, gross - iob))
            if net >= MIN_NET_CORRECTION:
                urgency = "critical" if max_val > 250 else "high" if max_val > 200 else "moderate"  # noqa: PLR2004
                return [ActionSuggestion(
                    type="hyper_correct",
                    urgency=urgency,
                    message=f"Consider correction: {net} u",
                    detail=(
                        f"Forecast peak: {round(max_val)} mg/dL at {max_h.horizon_min} min. "
                        f"Gross {gross:.1f} u − IOB {iob:.1f} u = {net} u net. "
                        f"CF: {round(block_cf)} mg/dL/u."
                    ),
                    disclaimer=_DISCLAIMER,
                )]
            # IOB already covering it
            return [ActionSuggestion(
                type="hyper_warn",
                urgency="low",
                message="Active IOB should bring glucose in range",
                detail=(
                    f"Forecast peak: {round(max_val)} mg/dL. "
                    f"IOB {iob:.1f} u is expected to cover this — no additional correction needed."
                ),
                disclaimer=_DISCLAIMER,
            )]

        urgency = "high" if max_val > 250 else "moderate"  # noqa: PLR2004
        return [ActionSuggestion(
            type="hyper_warn",
            urgency=urgency,
            message="Glucose trending high — monitor and consider a correction",
            detail=(
                f"Forecast: {round(max_val)} mg/dL at {max_h.horizon_min} min. "
                "CF data insufficient for a precise dose."
            ),
            disclaimer=_DISCLAIMER,
        )]

    # ── 4. On track ───────────────────────────────────────────────────────────
    return [ActionSuggestion(
        type="ok",
        urgency="low",
        message="On track — no action needed",
        detail=f"Glucose forecast stays in range (70–180 mg/dL) through {max_horizon} min.",
        disclaimer=_DISCLAIMER,
    )]
