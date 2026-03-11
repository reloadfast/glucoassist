"""Unit tests for forecasting service — pure logic, no DB access."""

from datetime import UTC, datetime, timedelta

import numpy as np
import pytest

from app.schemas.forecast import HorizonForecast
from app.services.forecasting import (
    HORIZONS,
    MIN_TRAIN_SAMPLES,
    N_FEATURES,
    _make_features,
    _make_targets,
    _normal_cdf,
    _overall_risk,
    _risk_level,
)


def _timestamps(n: int) -> list[datetime]:
    base = datetime(2026, 1, 1, 8, 0, tzinfo=UTC)
    return [base + timedelta(minutes=5 * i) for i in range(n)]


# ── Normal CDF ────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_normal_cdf_midpoint():
    assert abs(_normal_cdf(100.0, 100.0, 20.0) - 0.5) < 0.001


@pytest.mark.unit
def test_normal_cdf_extreme_low():
    assert _normal_cdf(0.0, 100.0, 5.0) < 0.001


@pytest.mark.unit
def test_normal_cdf_extreme_high():
    assert _normal_cdf(200.0, 100.0, 5.0) > 0.999


@pytest.mark.unit
def test_normal_cdf_zero_sigma_above():
    assert _normal_cdf(100.0, 100.0, 0.0) == 1.0


@pytest.mark.unit
def test_normal_cdf_zero_sigma_below():
    assert _normal_cdf(99.9, 100.0, 0.0) == 0.0


# ── Risk levels ───────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.parametrize(
    "p,expected",
    [
        (0.0, "low"),
        (0.09, "low"),
        (0.10, "moderate"),
        (0.24, "moderate"),
        (0.25, "high"),
        (0.49, "high"),
        (0.50, "critical"),
        (1.0, "critical"),
    ],
)
def test_risk_level_thresholds(p, expected):
    assert _risk_level(p) == expected


@pytest.mark.unit
def test_overall_risk_returns_worst():
    forecasts = [
        HorizonForecast(
            horizon_min=30,
            predicted_mg_dl=110,
            ci_lower=90,
            ci_upper=130,
            p_hypo=0.01,
            p_hyper=0.01,
            risk_level="low",
        ),
        HorizonForecast(
            horizon_min=60,
            predicted_mg_dl=200,
            ci_lower=180,
            ci_upper=220,
            p_hypo=0.01,
            p_hyper=0.30,
            risk_level="high",
        ),
    ]
    assert _overall_risk(forecasts) == "high"


@pytest.mark.unit
def test_overall_risk_empty():
    assert _overall_risk([]) == "unknown"


# ── Feature engineering ───────────────────────────────────────────────────────


@pytest.mark.unit
def test_make_features_shape():
    # range(5, n) gives n-5 rows; feature window is values[i-5:i+1] (includes current)
    n = 20
    values = [100.0 + i for i in range(n)]
    X = _make_features(values, _timestamps(n))
    assert X.shape == (n - 5, N_FEATURES)


@pytest.mark.unit
def test_make_features_too_few_rows():
    # Need at least 6 values for range(5, 5) = empty
    values = [100.0] * 5
    X = _make_features(values, _timestamps(5))
    assert X.shape[0] == 0


@pytest.mark.unit
def test_make_features_dtype():
    values = [100.0] * 15
    X = _make_features(values, _timestamps(15))
    assert X.dtype == np.float64


@pytest.mark.unit
def test_make_features_includes_current_reading():
    """Feature w[5] must equal the CURRENT reading (at index i), not i-1."""
    n = 10
    values = [float(v) for v in range(100, 100 + n)]  # 100, 101, ..., 109
    X = _make_features(values, _timestamps(n))
    # Row 0 corresponds to i=5: w = values[0:6], w[5] = values[5] = 105.0
    assert X[0, 5] == 105.0
    # Row 1 corresponds to i=6: w = values[1:7], w[5] = values[6] = 106.0
    assert X[1, 5] == 106.0


@pytest.mark.unit
def test_make_targets_shape():
    # Targets start at index 5+n_steps; len = n - 5 - n_steps
    n = 30
    values = [100.0 + i for i in range(n)]
    n_steps = HORIZONS[30]  # 6
    y = _make_targets(values, n_steps)
    assert len(y) == n - 5 - n_steps


@pytest.mark.unit
def test_make_targets_correct_offset():
    """Target for feature at i is values[i + n_steps] (n_steps × 5 min ahead)."""
    n = 20
    values = [float(v) for v in range(n)]  # 0, 1, ..., 19
    n_steps = HORIZONS[30]  # 6
    y = _make_targets(values, n_steps)
    # Row 0 of features → i=5, target should be values[5 + 6] = values[11] = 11.0
    assert y[0] == 11.0
    # Row 1 → i=6, target should be values[12] = 12.0
    assert y[1] == 12.0


@pytest.mark.unit
def test_make_features_and_targets_align():
    """n = min(len(X), len(y)) should reduce to correct paired count."""
    n = 50
    values = [100.0 + i * 0.5 for i in range(n)]
    n_steps = HORIZONS[60]  # 12
    X = _make_features(values, _timestamps(n))
    y = _make_targets(values, n_steps)
    paired = min(len(X), len(y))
    # X has n-5=45 rows, y has n-5-n_steps=33 rows
    assert paired == n - 5 - n_steps


@pytest.mark.unit
def test_n_features_is_15():
    assert N_FEATURES == 15


@pytest.mark.unit
def test_horizons_values():
    assert HORIZONS == {30: 6, 60: 12, 90: 18, 120: 24}


@pytest.mark.unit
def test_min_train_samples():
    assert MIN_TRAIN_SAMPLES == 288
