"""Unit tests for Phase 5 advanced pattern detectors."""

from datetime import UTC, datetime, timedelta

import pytest

from app.models.glucose import GlucoseReading
from app.models.health import HealthMetric
from app.models.pattern_history import PatternHistory
from app.schemas.analytics import PatternItem
from app.services.patterns import (
    _detect_basal_misalignment,
    _detect_hr_glucose_correlation,
    _detect_stress_resistance,
    _pearson,
    update_pattern_history,
)

# ── _pearson ──────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_pearson_positive():
    r = _pearson([1, 2, 3, 4, 5], [1, 2, 3, 4, 5])
    assert r == pytest.approx(1.0)


@pytest.mark.unit
def test_pearson_negative():
    r = _pearson([1, 2, 3, 4, 5], [5, 4, 3, 2, 1])
    assert r == pytest.approx(-1.0)


@pytest.mark.unit
def test_pearson_single_element():
    assert _pearson([5], [5]) == 0.0


@pytest.mark.unit
def test_pearson_zero_std():
    assert _pearson([1, 1, 1], [1, 2, 3]) == 0.0


# ── Stress Insulin Resistance ─────────────────────────────────────────────────


@pytest.mark.unit
def test_stress_resistance_no_data(db_session):
    result = _detect_stress_resistance(db_session)
    assert result.detected is False
    assert result.confidence is None


@pytest.mark.unit
def test_stress_resistance_not_enough_events(db_session):
    """One unexplained hyper event is not enough to flag."""
    now = datetime.now(UTC)
    # Add a single run of hyper readings
    for i in range(5):
        db_session.add(
            GlucoseReading(
                timestamp=now - timedelta(days=5, hours=2) + timedelta(minutes=i * 30),
                glucose_mg_dl=210,
                trend_arrow="Flat",
                source="nightscout",
            )
        )
    # Baseline readings 3–5 h before the run
    for i in range(3):
        db_session.add(
            GlucoseReading(
                timestamp=now - timedelta(days=5, hours=6) + timedelta(minutes=i * 30),
                glucose_mg_dl=120,
                trend_arrow="Flat",
                source="nightscout",
            )
        )
    db_session.commit()
    result = _detect_stress_resistance(db_session)
    # 1 event < 2 threshold → not detected
    assert result.detected is False


# ── Basal Rate Misalignment ────────────────────────────────────────────────────


@pytest.mark.unit
def test_basal_misalignment_no_data(db_session):
    result = _detect_basal_misalignment(db_session)
    assert result.detected is False
    assert result.confidence is None


@pytest.mark.unit
def test_basal_misalignment_not_enough_nights(db_session):
    """Only 2 nights — below the 5-night threshold."""
    now = datetime.now(UTC)
    for day in range(2):
        for i in range(5):
            db_session.add(
                GlucoseReading(
                    timestamp=now.replace(hour=0, minute=i * 12) - timedelta(days=day),
                    glucose_mg_dl=100 + i * 3,
                    trend_arrow="Flat",
                    source="nightscout",
                )
            )
    db_session.commit()
    result = _detect_basal_misalignment(db_session)
    assert result.detected is False


@pytest.mark.unit
def test_basal_misalignment_detected_rising(db_session):
    """7 nights of consistently rising overnight glucose → detected."""
    now = datetime.now(UTC)
    for day in range(8):
        for i in range(6):
            db_session.add(
                GlucoseReading(
                    timestamp=now.replace(hour=0, minute=i * 10) - timedelta(days=day),
                    glucose_mg_dl=100 + i * 5,  # rising within each night
                    trend_arrow="Flat",
                    source="nightscout",
                )
            )
    db_session.commit()
    result = _detect_basal_misalignment(db_session)
    assert result.detected is True
    assert "rising" in result.description
    assert result.confidence is not None and result.confidence >= 0.7


# ── HR-Glucose Correlation ────────────────────────────────────────────────────


@pytest.mark.unit
def test_hr_correlation_no_hr_data(db_session):
    result = _detect_hr_glucose_correlation(db_session)
    assert result.detected is False
    assert "No activity logs with heart rate" in result.description


@pytest.mark.unit
def test_hr_correlation_insufficient_pairs(db_session):
    """Activity with HR but no glucose readings around it → <5 pairs."""
    now = datetime.now(UTC)
    db_session.add(
        HealthMetric(
            timestamp=now - timedelta(days=1),
            activity_type="run",
            heart_rate_bpm=150,
        )
    )
    db_session.commit()
    result = _detect_hr_glucose_correlation(db_session)
    assert result.detected is False


@pytest.mark.unit
def test_hr_correlation_detected(db_session):
    """Seed 6 activity+HR logs with clear high-HR → big-drop correlation."""
    now = datetime.now(UTC)
    # higher HR → bigger glucose drop
    hr_values = [120, 130, 140, 150, 160, 170]
    drops = [10, 15, 20, 25, 30, 35]  # linear increase with HR

    for idx, (hr, drop) in enumerate(zip(hr_values, drops, strict=False)):
        act_time = now - timedelta(days=idx + 1, hours=14)

        # Pre-activity glucose (high)
        for j in range(3):
            db_session.add(
                GlucoseReading(
                    timestamp=act_time - timedelta(minutes=50 - j * 15),
                    glucose_mg_dl=150,
                    trend_arrow="Flat",
                    source="nightscout",
                )
            )

        # Post-activity glucose (dropped by 'drop' mg/dL)
        for j in range(3):
            db_session.add(
                GlucoseReading(
                    timestamp=act_time + timedelta(minutes=60 + j * 30),
                    glucose_mg_dl=150 - drop,
                    trend_arrow="Flat",
                    source="nightscout",
                )
            )

        db_session.add(
            HealthMetric(
                timestamp=act_time,
                activity_type="run",
                heart_rate_bpm=hr,
            )
        )

    db_session.commit()
    result = _detect_hr_glucose_correlation(db_session)
    assert result.detected is True
    assert result.confidence is not None and result.confidence >= 0.4


# ── update_pattern_history ────────────────────────────────────────────────────


@pytest.mark.unit
def test_update_pattern_history_inserts_detected(db_session):
    patterns = [
        PatternItem(name="Dawn Phenomenon", detected=True, description="test", confidence=0.8),
    ]
    update_pattern_history(db_session, patterns)
    row = db_session.query(PatternHistory).filter_by(pattern_name="Dawn Phenomenon").first()
    assert row is not None
    assert row.detection_count == 1
    assert row.last_confidence == pytest.approx(0.8)


@pytest.mark.unit
def test_update_pattern_history_skips_undetected(db_session):
    patterns = [
        PatternItem(name="Basal Drift", detected=False, description="none", confidence=None),
    ]
    update_pattern_history(db_session, patterns)
    row = db_session.query(PatternHistory).filter_by(pattern_name="Basal Drift").first()
    assert row is None


@pytest.mark.unit
def test_update_pattern_history_upsert_increments_count(db_session):
    patterns = [
        PatternItem(name="Exercise Sensitivity", detected=True, description="test", confidence=0.5),
    ]
    update_pattern_history(db_session, patterns)
    update_pattern_history(db_session, patterns)
    row = db_session.query(PatternHistory).filter_by(pattern_name="Exercise Sensitivity").first()
    assert row is not None
    assert row.detection_count == 2
