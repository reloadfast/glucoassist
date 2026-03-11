"""
Glucose forecasting service.

Model: Ridge regression (scikit-learn) per horizon (30, 60, 90, 120 min).
Features (15): last 6 glucose values (current reading at w[5]) + 5-min delta
               + 10-min delta + avg rate + hour_sin/cos + weekday_sin/cos
               + IOB (insulin on board) + COB (carbs on board).
CI: empirical 80% — predicted ± 1.28 * residual_std from validation residuals.
Risk: P(hypo < 70) and P(hyper > 250) via normal CDF from math.erfc (stdlib only).
Storage: joblib files alongside the SQLite DB file.
Registry: JSON manifest of training runs; A/B promotion guards live models.
"""

import json
import logging
import math
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import NamedTuple

import joblib
import numpy as np
from sklearn.linear_model import Ridge
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.glucose import GlucoseReading
from app.models.insulin import InsulinDose
from app.models.meal import Meal
from app.schemas.forecast import ForecastResponse, HorizonForecast, ModelMeta
from app.services.iob import COB_DIA_MIN, RAPID_DIA_MIN, cob_fraction, iob_fraction

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────
HORIZONS: dict[int, int] = {30: 6, 60: 12, 90: 18, 120: 24}  # horizon_min → n_steps
MIN_TRAIN_SAMPLES = 288  # 1 full day at 5-min intervals
CI_Z = 1.28  # 80% confidence interval (±1.28σ)
HYPO_THRESHOLD = 70.0
HYPER_THRESHOLD = 250.0
RISK_THRESHOLDS = [  # (upper_exclusive, level)
    (0.10, "low"),
    (0.25, "moderate"),
    (0.50, "high"),
    (1.01, "critical"),
]
VALIDATION_FRACTION = 0.2
RANDOM_STATE = 42
N_FEATURES = 15  # 6 glucose + 3 rate + 2 hour cyclic + 2 weekday cyclic + 1 IOB + 1 COB
REGISTRY_MAX_ENTRIES = 50


# ── Return type for train_models ───────────────────────────────────────────────


class TrainResult(NamedTuple):
    success: bool
    promoted: bool
    training_samples: int
    maes: dict[str, float]
    notes: str


# ── Path helpers ───────────────────────────────────────────────────────────────


def _model_dir() -> Path:
    settings = get_settings()
    return Path(settings.database_path).parent


def _model_path(horizon_min: int) -> Path:
    return _model_dir() / f"model_h{horizon_min}.joblib"


def _candidate_model_path(horizon_min: int) -> Path:
    return _model_dir() / f"model_h{horizon_min}_candidate.joblib"


def _meta_path() -> Path:
    return _model_dir() / "model_meta.json"


def _registry_path() -> Path:
    return _model_dir() / "model_registry.json"


def models_exist() -> bool:
    return all(_model_path(h).exists() for h in HORIZONS)


def _delete_live_models() -> None:
    """Remove all live model files (forces retrain on next scheduled run)."""
    for horizon_min in HORIZONS:
        p = _model_path(horizon_min)
        if p.exists():
            p.unlink()


# ── Registry helpers ───────────────────────────────────────────────────────────


def _load_registry() -> list[dict]:
    p = _registry_path()
    if not p.exists():
        return []
    try:
        return json.loads(p.read_text())
    except Exception:
        return []


def _append_registry(entry: dict) -> None:
    entries = _load_registry()
    entries.append(entry)
    entries = entries[-REGISTRY_MAX_ENTRIES:]
    _registry_path().write_text(json.dumps(entries, indent=2))


def _current_mae() -> dict[str, float] | None:
    p = _meta_path()
    if not p.exists():
        return None
    try:
        data = json.loads(p.read_text())
        return data.get("mae_per_horizon")
    except Exception:
        return None


def _should_promote(
    current_maes: dict[str, float] | None,
    candidate_maes: dict[str, float],
) -> bool:
    """Promote when no current model exists, or candidate mean MAE is strictly better."""
    if current_maes is None:
        return True
    current_mean = sum(current_maes.values()) / len(current_maes)
    candidate_mean = sum(candidate_maes.values()) / len(candidate_maes)
    return candidate_mean < current_mean


# ── Feature engineering ────────────────────────────────────────────────────────


def _make_features(
    values: list[float],
    timestamps: list[datetime],
    iob_values: list[float] | None = None,
    cob_values: list[float] | None = None,
) -> np.ndarray:
    """
    Build feature matrix from a chronologically sorted glucose series.
    Requires at least 6 rows to produce any output.
    Returns shape (n_samples, N_FEATURES).

    Features per row (all at index i where i >= 5):
      0-5  : glucose values v[i-5] … v[i]   (w[5] = current reading)
      6    : 5-min delta   v[i] - v[i-1]
      7    : 10-min delta  v[i] - v[i-2]
      8    : avg rate      (v[i] - v[i-5]) / 5
      9    : sin(hour_of_day * 2π/24)
      10   : cos(hour_of_day * 2π/24)
      11   : sin(weekday * 2π/7)
      12   : cos(weekday * 2π/7)
      13   : IOB (units of active rapid-acting insulin)
      14   : COB (grams of active carbohydrates)

    The feature at row i represents the system state at timestamp[i], and the
    paired target is the glucose value n_steps readings into the future.
    """
    rows = []
    for i in range(5, len(values)):
        w = values[i - 5 : i + 1]  # w[0]=oldest, w[5]=current reading at index i
        ts = timestamps[i]
        hour_frac = ts.hour + ts.minute / 60.0
        wd = ts.weekday()
        iob = iob_values[i] if iob_values is not None else 0.0
        cob = cob_values[i] if cob_values is not None else 0.0
        rows.append(
            [
                w[0],
                w[1],
                w[2],
                w[3],
                w[4],
                w[5],
                w[5] - w[4],  # 5-min delta
                w[5] - w[3],  # 10-min delta
                (w[5] - w[0]) / 5.0,  # avg rate over 25 min
                math.sin(2 * math.pi * hour_frac / 24.0),
                math.cos(2 * math.pi * hour_frac / 24.0),
                math.sin(2 * math.pi * wd / 7.0),
                math.cos(2 * math.pi * wd / 7.0),
                iob,
                cob,
            ]
        )
    return np.array(rows, dtype=np.float64)


def _make_targets(values: list[float], n_steps: int) -> np.ndarray:
    """
    Target for feature row i (which uses values[i-5:i+1] as features, current
    reading at i) is values[i + n_steps] — exactly n_steps × 5 min into the
    future.  Feature rows start at index 5; valid target indices end at
    len(values) - 1.  Returns len(values) - 5 - n_steps targets.
    """
    return np.array(values[5 + n_steps : len(values)], dtype=np.float64)


# ── Internal model container ───────────────────────────────────────────────────


class _HorizonModel:
    """Bundles a fitted Ridge + StandardScaler + residual_std for one horizon."""

    def __init__(self, ridge: Ridge, scaler: StandardScaler, residual_std: float):
        self.ridge = ridge
        self.scaler = scaler
        self.residual_std = residual_std


# ── Training ───────────────────────────────────────────────────────────────────


def train_models(db: Session, trigger_source: str = "scheduled") -> TrainResult:
    """
    Fetch all readings, train Ridge models for all three horizons.

    Candidate models are evaluated against the current live models (A/B comparison).
    Live models are only replaced when the candidate mean MAE is strictly better.
    Returns TrainResult with success/promoted flags and per-horizon MAEs.
    """
    rows = (
        db.query(GlucoseReading.timestamp, GlucoseReading.glucose_mg_dl)
        .order_by(GlucoseReading.timestamp.asc())
        .all()
    )

    if len(rows) < MIN_TRAIN_SAMPLES:
        logger.info(
            "Forecasting: insufficient data (%d < %d) — skipping training",
            len(rows),
            MIN_TRAIN_SAMPLES,
        )
        return TrainResult(
            success=False,
            promoted=False,
            training_samples=len(rows),
            maes={},
            notes=f"Insufficient data: {len(rows)} < {MIN_TRAIN_SAMPLES}",
        )

    values = [float(r.glucose_mg_dl) for r in rows]
    timestamps = [r.timestamp for r in rows]

    # Precompute IOB at each glucose timestamp from rapid-acting insulin logs.
    # Load all rapid doses once to avoid N individual queries.
    rapid_doses = (
        db.query(InsulinDose.timestamp, InsulinDose.units)
        .filter(InsulinDose.type == "rapid")
        .order_by(InsulinDose.timestamp.asc())
        .all()
    )
    iob_values: list[float] = []
    for ts in timestamps:
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=UTC)
        cutoff = ts - timedelta(minutes=RAPID_DIA_MIN)
        total = 0.0
        for d in rapid_doses:
            d_ts = d.timestamp
            if d_ts.tzinfo is None:
                d_ts = d_ts.replace(tzinfo=UTC)
            if cutoff <= d_ts <= ts:
                total += d.units * iob_fraction((ts - d_ts).total_seconds() / 60.0)
        iob_values.append(total)

    # Precompute COB (carbs on board) at each glucose timestamp from meal logs.
    meals = (
        db.query(Meal.timestamp, Meal.carbs_g)
        .order_by(Meal.timestamp.asc())
        .all()
    )
    cob_values: list[float] = []
    for ts in timestamps:
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=UTC)
        cutoff = ts - timedelta(minutes=COB_DIA_MIN)
        total = 0.0
        for m in meals:
            m_ts = m.timestamp
            if m_ts.tzinfo is None:
                m_ts = m_ts.replace(tzinfo=UTC)
            if cutoff <= m_ts <= ts:
                total += m.carbs_g * cob_fraction((ts - m_ts).total_seconds() / 60.0)
        cob_values.append(total)

    X_all = _make_features(values, timestamps, iob_values, cob_values)

    model_dir = _model_dir()
    model_dir.mkdir(parents=True, exist_ok=True)

    candidate_maes: dict[str, float] = {}
    for horizon_min, n_steps in HORIZONS.items():
        y = _make_targets(values, n_steps)
        n = min(len(X_all), len(y))
        if n < 50:  # noqa: PLR2004
            logger.warning(
                "Forecasting: too few aligned samples for h%d — skipping",
                horizon_min,
            )
            _cleanup_candidates()
            return TrainResult(
                success=False,
                promoted=False,
                training_samples=len(rows),
                maes={},
                notes=f"Too few aligned samples for h{horizon_min}",
            )

        X, y = X_all[:n], y[:n]
        X_tr, X_val, y_tr, y_val = train_test_split(
            X, y, test_size=VALIDATION_FRACTION, shuffle=False, random_state=RANDOM_STATE
        )

        scaler = StandardScaler()
        X_tr_s = scaler.fit_transform(X_tr)
        X_val_s = scaler.transform(X_val)

        ridge = Ridge(alpha=1.0)
        ridge.fit(X_tr_s, y_tr)

        val_preds = ridge.predict(X_val_s)
        residuals = y_val - val_preds
        residual_std = float(np.std(residuals))
        mae = float(np.mean(np.abs(residuals)))

        hm = _HorizonModel(ridge, scaler, residual_std)
        joblib.dump(hm, _candidate_model_path(horizon_min))
        candidate_maes[f"h{horizon_min}"] = round(mae, 2)
        logger.info(
            "Forecasting: trained candidate h%d  MAE=%.2f  residual_std=%.2f",
            horizon_min,
            mae,
            residual_std,
        )

    current_maes = _current_mae()
    promoted = _should_promote(current_maes, candidate_maes)
    trained_at = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f") + "Z"

    if promoted:
        for horizon_min in HORIZONS:
            _candidate_model_path(horizon_min).replace(_model_path(horizon_min))
        meta = {
            "last_trained": trained_at,
            "training_samples": len(rows),
            "mae_per_horizon": candidate_maes,
        }
        _meta_path().write_text(json.dumps(meta))
        notes = (
            "Promoted (first training)"
            if current_maes is None
            else (
                f"Promoted: mean MAE "
                f"{round(sum(candidate_maes.values()) / len(candidate_maes), 2)}"
                f" < current "
                f"{round(sum(current_maes.values()) / len(current_maes), 2)}"
            )
        )
        logger.info("Forecasting: candidate promoted — %s", notes)
    else:
        _cleanup_candidates()
        cur_mean = round(sum(current_maes.values()) / len(current_maes), 2) if current_maes else 0
        cand_mean = round(sum(candidate_maes.values()) / len(candidate_maes), 2)
        notes = f"Not promoted: candidate mean MAE {cand_mean} >= current {cur_mean}"
        logger.info("Forecasting: candidate not promoted — %s", notes)

    _append_registry(
        {
            "version_id": trained_at,
            "training_samples": len(rows),
            "mae_per_horizon": candidate_maes,
            "promoted": promoted,
            "trained_at": trained_at,
            "trigger_source": trigger_source,
        }
    )

    return TrainResult(
        success=True,
        promoted=promoted,
        training_samples=len(rows),
        maes=candidate_maes,
        notes=notes,
    )


def _cleanup_candidates() -> None:
    for horizon_min in HORIZONS:
        p = _candidate_model_path(horizon_min)
        if p.exists():
            p.unlink()


# ── Risk math (stdlib only) ────────────────────────────────────────────────────


def _normal_cdf(x: float, mu: float, sigma: float) -> float:
    """P(X ≤ x) for X ~ N(mu, sigma) via math.erfc. No scipy required."""
    if sigma <= 0:
        return 1.0 if x >= mu else 0.0
    z = (x - mu) / (sigma * math.sqrt(2))
    return 0.5 * math.erfc(-z)


def _risk_level(p: float) -> str:
    for upper, level in RISK_THRESHOLDS:
        if p < upper:
            return level
    return "critical"


def _overall_risk(forecasts: list[HorizonForecast]) -> str:
    if not forecasts:
        return "unknown"
    order = ["low", "moderate", "high", "critical"]
    return max(forecasts, key=lambda f: order.index(f.risk_level)).risk_level


# ── Inference ─────────────────────────────────────────────────────────────────


def _load_meta() -> ModelMeta:
    p = _meta_path()
    if not p.exists():
        return ModelMeta(last_trained=None, training_samples=None, mae_per_horizon=None)
    try:
        data = json.loads(p.read_text())
        return ModelMeta(
            last_trained=data.get("last_trained"),
            training_samples=data.get("training_samples"),
            mae_per_horizon=data.get("mae_per_horizon"),
        )
    except Exception:
        logger.exception("Forecasting: failed to load model_meta.json")
        return ModelMeta(last_trained=None, training_samples=None, mae_per_horizon=None)


def get_forecast(db: Session) -> ForecastResponse:
    """
    Build forecast from the most recent readings. Returns graceful degradation
    when models are not yet trained or there are fewer than 6 live readings.
    """
    meta = _load_meta()

    if not models_exist():
        return ForecastResponse(
            model_trained=False, forecasts=[], overall_risk="unknown", meta=meta
        )

    # Guard against stale models trained with a different feature count.
    for horizon_min in HORIZONS:
        try:
            hm_check: _HorizonModel = joblib.load(_model_path(horizon_min))
            if hm_check.scaler.n_features_in_ != N_FEATURES:
                logger.warning(
                    "Forecasting: stale model h%d expects %d features but N_FEATURES=%d"
                    " — purging live models for retrain",
                    horizon_min,
                    hm_check.scaler.n_features_in_,
                    N_FEATURES,
                )
                _delete_live_models()
                return ForecastResponse(
                    model_trained=False, forecasts=[], overall_risk="unknown", meta=meta
                )
        except Exception:
            logger.exception("Forecasting: failed to validate model h%d — purging", horizon_min)
            _delete_live_models()
            return ForecastResponse(
                model_trained=False, forecasts=[], overall_risk="unknown", meta=meta
            )

    rows = (
        db.query(GlucoseReading.timestamp, GlucoseReading.glucose_mg_dl)
        .order_by(GlucoseReading.timestamp.desc())
        .limit(10)
        .all()
    )
    rows = list(reversed(rows))  # chronological asc

    if len(rows) < 6:  # noqa: PLR2004
        return ForecastResponse(model_trained=True, forecasts=[], overall_risk="unknown", meta=meta)

    values = [float(r.glucose_mg_dl) for r in rows]
    timestamps = [r.timestamp for r in rows]

    try:
        from app.services.iob import compute_cob, compute_iob

        iob_now = compute_iob(db)
        cob_now = compute_cob(db)
        # Use current IOB/COB for all inference rows; only X_all[-1] matters.
        iob_values = [iob_now] * len(values)
        cob_values = [cob_now] * len(values)
        X_all = _make_features(values, timestamps, iob_values, cob_values)
        if len(X_all) == 0:
            return ForecastResponse(
                model_trained=True, forecasts=[], overall_risk="unknown", meta=meta
            )
        x_latest = X_all[-1].reshape(1, -1)
    except Exception:
        logger.exception("Forecasting: feature engineering failed during inference")
        return ForecastResponse(model_trained=True, forecasts=[], overall_risk="unknown", meta=meta)

    forecasts: list[HorizonForecast] = []
    for horizon_min in sorted(HORIZONS):
        try:
            hm: _HorizonModel = joblib.load(_model_path(horizon_min))
            x_scaled = hm.scaler.transform(x_latest)
            predicted = float(hm.ridge.predict(x_scaled)[0])
            std = hm.residual_std

            ci_lower = predicted - CI_Z * std
            ci_upper = predicted + CI_Z * std
            p_hypo = _normal_cdf(HYPO_THRESHOLD, predicted, std)
            p_hyper = 1.0 - _normal_cdf(HYPER_THRESHOLD, predicted, std)
            risk_level = _risk_level(max(p_hypo, p_hyper))

            forecasts.append(
                HorizonForecast(
                    horizon_min=horizon_min,
                    predicted_mg_dl=round(predicted, 1),
                    ci_lower=round(ci_lower, 1),
                    ci_upper=round(ci_upper, 1),
                    p_hypo=round(p_hypo, 4),
                    p_hyper=round(p_hyper, 4),
                    risk_level=risk_level,
                )
            )
        except Exception:
            logger.exception("Forecasting: inference failed for h%d", horizon_min)

    return ForecastResponse(
        model_trained=True,
        forecasts=forecasts,
        overall_risk=_overall_risk(forecasts),
        meta=meta,
    )
