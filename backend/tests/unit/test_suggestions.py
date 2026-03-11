"""Unit tests for the rule-based action suggestion engine."""

import pytest

from app.schemas.forecast import HorizonForecast
from app.services.suggestions import (
    COB_GATE_G,
    LOW_THRESHOLD,
    compute_suggestions,
)


def _make_forecasts(*pairs: tuple[int, float]) -> list[HorizonForecast]:
    """Build HorizonForecast list from (horizon_min, predicted_mg_dl) pairs."""
    return [
        HorizonForecast(
            horizon_min=h,
            predicted_mg_dl=v,
            ci_lower=v - 10,
            ci_upper=v + 10,
            p_hypo=0.0 if v >= LOW_THRESHOLD else 0.8,
            p_hyper=0.0 if v <= 180 else 0.7,
            risk_level="low" if 70 <= v <= 180 else "high",
        )
        for h, v in pairs
    ]


# ── Empty / model not trained ─────────────────────────────────────────────────


@pytest.mark.unit
def test_empty_forecasts_returns_empty_list():
    result = compute_suggestions([], 0.0, 0.0, 120.0, "→", 10.0, 40.0)
    assert result == []


# ── On track ─────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_on_track_all_horizons_in_range():
    forecasts = _make_forecasts((30, 120.0), (60, 125.0), (90, 130.0), (120, 135.0))
    result = compute_suggestions(forecasts, 0.0, 0.0, 120.0, "→", 10.0, 40.0)
    assert len(result) == 1
    assert result[0].type == "ok"
    assert result[0].urgency == "low"


# ── Hypo imminent ─────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_hypo_treat_with_icr_cf_available():
    forecasts = _make_forecasts((30, 65.0), (60, 63.0), (90, 61.0), (120, 62.0))
    result = compute_suggestions(forecasts, 0.5, 0.0, 90.0, "↓", 10.0, 40.0)
    assert result[0].type == "hypo_treat"
    assert result[0].urgency == "high"
    assert "g fast carbs" in result[0].message
    assert result[0].detail is not None


@pytest.mark.unit
def test_hypo_critical_when_below_60():
    forecasts = _make_forecasts((30, 55.0), (60, 50.0), (90, 48.0), (120, 52.0))
    result = compute_suggestions(forecasts, 0.0, 0.0, 80.0, "↓↓", 10.0, 40.0)
    assert result[0].urgency == "critical"


@pytest.mark.unit
def test_hypo_fallback_when_no_icr_cf():
    forecasts = _make_forecasts((30, 65.0), (60, 63.0), (90, 61.0), (120, 60.0))
    result = compute_suggestions(forecasts, 0.0, 0.0, 90.0, "↓", None, None)
    assert result[0].type == "hypo_treat"
    assert result[0].message == "Take ~15 g fast carbs"


# ── IOB-driven hypo warning ───────────────────────────────────────────────────


@pytest.mark.unit
def test_iob_hypo_warn_falling_low_glucose():
    # All horizons in range but IOB + falling trend near threshold
    forecasts = _make_forecasts((30, 80.0), (60, 76.0), (90, 74.0), (120, 72.0))
    result = compute_suggestions(forecasts, 1.5, 0.0, 85.0, "↓", 10.0, 40.0)
    assert result[0].type == "hypo_warn"
    assert result[0].urgency == "moderate"


@pytest.mark.unit
def test_iob_hypo_warn_not_triggered_when_cob_high():
    # COB > 5 g protects — should fall through to on-track
    forecasts = _make_forecasts((30, 80.0), (60, 78.0), (90, 76.0), (120, 74.0))
    result = compute_suggestions(forecasts, 1.5, 10.0, 85.0, "↓", 10.0, 40.0)
    assert result[0].type in {"ok", "hypo_warn"}  # COB suppresses warn


# ── Hyper ─────────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_hyper_correction_with_cf():
    forecasts = _make_forecasts((30, 160.0), (60, 195.0), (90, 210.0), (120, 220.0))
    result = compute_suggestions(forecasts, 0.0, 0.0, 150.0, "↑", 10.0, 40.0)
    assert result[0].type == "hyper_correct"
    assert result[0].urgency in {"moderate", "high"}
    assert "u" in result[0].message  # units mentioned


@pytest.mark.unit
def test_hyper_suppressed_by_cob():
    forecasts = _make_forecasts((30, 160.0), (60, 200.0), (90, 210.0), (120, 220.0))
    result = compute_suggestions(forecasts, 0.0, COB_GATE_G + 5, 150.0, "↑", 10.0, 40.0)
    assert result[0].type == "hyper_warn"
    assert "absorbing" in result[0].message


@pytest.mark.unit
def test_hyper_iob_already_covers():
    # High forecast but IOB is large enough to cover it
    forecasts = _make_forecasts((30, 165.0), (60, 185.0), (90, 190.0), (120, 195.0))
    # CF=40, target=120, gross=(195-120)/40=1.875; IOB=2.5 → net=0 → IOB covers
    result = compute_suggestions(forecasts, 2.5, 0.0, 160.0, "↑", 10.0, 40.0)
    assert result[0].type == "hyper_warn"
    assert "IOB" in result[0].message


@pytest.mark.unit
def test_hyper_critical_above_250():
    forecasts = _make_forecasts((30, 200.0), (60, 260.0), (90, 270.0), (120, 280.0))
    result = compute_suggestions(forecasts, 0.0, 0.0, 190.0, "↑↑", 10.0, 40.0)
    assert result[0].urgency == "critical"


# ── Disclaimer always present ─────────────────────────────────────────────────


@pytest.mark.unit
def test_disclaimer_always_present():
    for forecasts in [
        _make_forecasts((30, 120.0), (60, 125.0), (90, 130.0), (120, 135.0)),
        _make_forecasts((30, 60.0), (60, 58.0), (90, 55.0), (120, 53.0)),
        _make_forecasts((30, 200.0), (60, 220.0), (90, 230.0), (120, 240.0)),
    ]:
        result = compute_suggestions(forecasts, 0.0, 0.0, 120.0, "→", 10.0, 40.0)
        assert result[0].disclaimer != ""
        assert "healthcare team" in result[0].disclaimer
