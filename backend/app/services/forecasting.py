"""
Glucose forecasting service.

Model: Ridge regression (scikit-learn) per horizon (30, 60, 120 min).
Features (13): last 6 glucose values + 5-min delta + 10-min delta + avg rate
               + hour_sin/cos + weekday_sin/cos.
CI: empirical 80% — predicted ± 1.28 * residual_std from validation residuals.
Risk: P(hypo < 70) and P(hyper > 250) via normal CDF from math.erfc (stdlib only).
Storage: joblib files alongside the SQLite DB file.
"""
import json
import logging
import math
from datetime import UTC, datetime
from pathlib import Path

import joblib
import numpy as np
from sklearn.linear_model import Ridge
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.glucose import GlucoseReading
from app.schemas.forecast import ForecastResponse, HorizonForecast, ModelMeta

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────
HORIZONS: dict[int, int] = {30: 6, 60: 12, 120: 24}  # horizon_min → n_steps
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
N_FEATURES = 13  # 6 glucose + 3 rate features + 2 hour cyclic + 2 weekday cyclic


# ── Path helpers ───────────────────────────────────────────────────────────────

def _model_dir() -> Path:
    settings = get_settings()
    return Path(settings.database_path).parent


def _model_path(horizon_min: int) -> Path:
    return _model_dir() / f"model_h{horizon_min}.joblib"


def _meta_path() -> Path:
    return _model_dir() / "model_meta.json"


def models_exist() -> bool:
    return all(_model_path(h).exists() for h in HORIZONS)


# ── Feature engineering ────────────────────────────────────────────────────────

def _make_features(values: list[float], timestamps: list[datetime]) -> np.ndarray:
    """
    Build feature matrix from a chronologically sorted glucose series.
    Requires at least 7 rows to produce any output.
    Returns shape (n_samples, N_FEATURES).

    Features per row (all at index i where i >= 6):
      0-5  : glucose values v[i-5] … v[i]
      6    : 5-min delta  v[i] - v[i-1]
      7    : 10-min delta v[i] - v[i-2]
      8    : avg rate     (v[i] - v[i-5]) / 5
      9    : sin(hour_of_day * 2π/24)
      10   : cos(hour_of_day * 2π/24)
      11   : sin(weekday * 2π/7)
      12   : cos(weekday * 2π/7)
    """
    rows = []
    for i in range(6, len(values)):
        w = values[i - 6 : i]  # w[0]=oldest, w[5]=current
        ts = timestamps[i]
        hour_frac = ts.hour + ts.minute / 60.0
        wd = ts.weekday()
        rows.append([
            w[0], w[1], w[2], w[3], w[4], w[5],
            w[5] - w[4],          # 5-min delta
            w[5] - w[3],          # 10-min delta
            (w[5] - w[0]) / 5.0,  # avg rate
            math.sin(2 * math.pi * hour_frac / 24.0),
            math.cos(2 * math.pi * hour_frac / 24.0),
            math.sin(2 * math.pi * wd / 7.0),
            math.cos(2 * math.pi * wd / 7.0),
        ])
    return np.array(rows, dtype=np.float64)


def _make_targets(values: list[float], n_steps: int) -> np.ndarray:
    """
    Target for feature row i (which uses values[i-6:i] as base) is values[i + n_steps].
    Feature rows start at index 6; valid target indices end at len(values) - n_steps.
    """
    return np.array(values[6 : len(values) - n_steps], dtype=np.float64)


# ── Internal model container ───────────────────────────────────────────────────

class _HorizonModel:
    """Bundles a fitted Ridge + StandardScaler + residual_std for one horizon."""

    def __init__(self, ridge: Ridge, scaler: StandardScaler, residual_std: float):
        self.ridge = ridge
        self.scaler = scaler
        self.residual_std = residual_std


# ── Training ───────────────────────────────────────────────────────────────────

def train_models(db: Session) -> bool:
    """
    Fetch all readings, train Ridge models for all three horizons, persist to disk.
    Returns True on success, False when insufficient data.
    Thread-safe for reads; joblib.dump writes atomically on most filesystems.
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
        return False

    values = [float(r.glucose_mg_dl) for r in rows]
    timestamps = [r.timestamp for r in rows]
    X_all = _make_features(values, timestamps)

    model_dir = _model_dir()
    model_dir.mkdir(parents=True, exist_ok=True)

    maes: dict[str, float] = {}
    for horizon_min, n_steps in HORIZONS.items():
        y = _make_targets(values, n_steps)
        n = min(len(X_all), len(y))
        if n < 50:  # noqa: PLR2004
            logger.warning("Forecasting: too few aligned samples for h%d — skipping", horizon_min)
            return False

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
        joblib.dump(hm, _model_path(horizon_min))
        maes[f"h{horizon_min}"] = round(mae, 2)
        logger.info(
            "Forecasting: trained h%d model  MAE=%.2f  residual_std=%.2f",
            horizon_min, mae, residual_std,
        )

    meta = {
        "last_trained": datetime.now(UTC).isoformat(),
        "training_samples": len(rows),
        "mae_per_horizon": maes,
    }
    _meta_path().write_text(json.dumps(meta))
    logger.info("Forecasting: all models trained — meta=%s", meta)
    return True


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
        X_all = _make_features(values, timestamps)
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

            forecasts.append(HorizonForecast(
                horizon_min=horizon_min,
                predicted_mg_dl=round(predicted, 1),
                ci_lower=round(ci_lower, 1),
                ci_upper=round(ci_upper, 1),
                p_hypo=round(p_hypo, 4),
                p_hyper=round(p_hyper, 4),
                risk_level=risk_level,
            ))
        except Exception:
            logger.exception("Forecasting: inference failed for h%d", horizon_min)

    return ForecastResponse(
        model_trained=True,
        forecasts=forecasts,
        overall_risk=_overall_risk(forecasts),
        meta=meta,
    )
