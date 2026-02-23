"""Unit tests for pattern detection services."""

from datetime import UTC, datetime, timedelta

import pytest

from app.models.glucose import GlucoseReading
from app.services.patterns import (
    _detect_basal_drift,
    _detect_dawn_phenomenon,
    _detect_delayed_carb_absorption,
    _detect_exercise_sensitivity,
    _ols_slope,
)


@pytest.mark.unit
def test_ols_slope_flat():
    assert _ols_slope([0, 1, 2], [5, 5, 5]) == pytest.approx(0.0)


@pytest.mark.unit
def test_ols_slope_positive():
    slope = _ols_slope([0, 1, 2], [0, 2, 4])
    assert slope == pytest.approx(2.0)


@pytest.mark.unit
def test_ols_slope_negative():
    slope = _ols_slope([0, 1, 2], [6, 4, 2])
    assert slope == pytest.approx(-2.0)


@pytest.mark.unit
def test_ols_slope_single_point():
    assert _ols_slope([0], [5]) == 0.0


# ── Dawn Phenomenon ───────────────────────────────────────────────────────────


@pytest.mark.unit
def test_dawn_no_data(db_session):
    result = _detect_dawn_phenomenon(db_session)
    assert result.detected is False
    assert "Insufficient" in result.description


@pytest.mark.unit
def test_dawn_detected(db_session):
    base = datetime.now(UTC).replace(hour=3, minute=0, second=0, microsecond=0)
    # 6 predawn readings at 80 mg/dL (02:00–04:00 range)
    for i in range(6):
        db_session.add(
            GlucoseReading(
                timestamp=base - timedelta(days=i),
                glucose_mg_dl=80,
                trend_arrow="Flat",
                source="nightscout",
            )
        )
    # 6 morning readings at 110 mg/dL (06:00–09:00 range)
    morning_base = datetime.now(UTC).replace(hour=7, minute=0, second=0, microsecond=0)
    for i in range(6):
        db_session.add(
            GlucoseReading(
                timestamp=morning_base - timedelta(days=i),
                glucose_mg_dl=110,
                trend_arrow="Flat",
                source="nightscout",
            )
        )
    db_session.commit()

    result = _detect_dawn_phenomenon(db_session)
    assert result.detected is True
    assert result.confidence is not None and result.confidence > 0


@pytest.mark.unit
def test_dawn_not_detected(db_session):
    base = datetime.now(UTC).replace(hour=3, minute=0, second=0, microsecond=0)
    for i in range(6):
        db_session.add(
            GlucoseReading(
                timestamp=base - timedelta(days=i),
                glucose_mg_dl=100,
                trend_arrow="Flat",
                source="nightscout",
            )
        )
    morning_base = datetime.now(UTC).replace(hour=7, minute=0, second=0, microsecond=0)
    for i in range(6):
        db_session.add(
            GlucoseReading(
                timestamp=morning_base - timedelta(days=i),
                glucose_mg_dl=105,  # only +5 rise
                trend_arrow="Flat",
                source="nightscout",
            )
        )
    db_session.commit()

    result = _detect_dawn_phenomenon(db_session)
    assert result.detected is False


# ── Basal Drift ───────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_basal_drift_no_data(db_session):
    result = _detect_basal_drift(db_session)
    assert result.detected is False
    assert "data" in result.description.lower()


@pytest.mark.unit
def test_basal_drift_detected_upward(db_session):
    now = datetime.now(UTC)
    for day in range(10):
        ts = now - timedelta(days=9 - day)
        db_session.add(
            GlucoseReading(
                timestamp=ts.replace(hour=12),
                glucose_mg_dl=100 + day * 5,  # +5/day → slope well above 2
                trend_arrow="Flat",
                source="nightscout",
            )
        )
    db_session.commit()
    result = _detect_basal_drift(db_session)
    assert result.detected is True
    assert "upward" in result.description


@pytest.mark.unit
def test_basal_drift_not_detected(db_session):
    now = datetime.now(UTC)
    for day in range(10):
        ts = now - timedelta(days=9 - day)
        db_session.add(
            GlucoseReading(
                timestamp=ts.replace(hour=12),
                glucose_mg_dl=110,  # flat
                trend_arrow="Flat",
                source="nightscout",
            )
        )
    db_session.commit()
    result = _detect_basal_drift(db_session)
    assert result.detected is False


# ── Exercise Sensitivity ──────────────────────────────────────────────────────


@pytest.mark.unit
def test_exercise_no_activities(db_session):
    result = _detect_exercise_sensitivity(db_session)
    assert result.detected is False
    assert "No activity" in result.description


# ── Delayed Carb Absorption ───────────────────────────────────────────────────


@pytest.mark.unit
def test_delayed_carb_no_meals(db_session):
    result = _detect_delayed_carb_absorption(db_session)
    assert result.detected is False
    assert "No meal" in result.description
