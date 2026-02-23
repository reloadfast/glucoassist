from datetime import UTC, datetime

import pytest

from app.models.glucose import GlucoseReading
from app.models.health import HealthMetric
from app.models.insulin import InsulinDose
from app.models.meal import Meal

NOW = datetime.now(tz=UTC)


@pytest.mark.unit
def test_glucose_reading_columns():
    r = GlucoseReading(
        timestamp=NOW,
        glucose_mg_dl=120,
        trend_arrow="Flat",
        source="librelink",
        device_id="device-1",
    )
    assert r.glucose_mg_dl == 120
    assert r.trend_arrow == "Flat"
    assert r.source == "librelink"
    assert r.device_id == "device-1"


@pytest.mark.unit
def test_glucose_reading_nullable_fields():
    r = GlucoseReading(timestamp=NOW, glucose_mg_dl=100, source="nightscout")
    assert r.trend_arrow is None
    assert r.device_id is None


@pytest.mark.unit
def test_insulin_dose_columns():
    dose = InsulinDose(timestamp=NOW, units=4.5, type="rapid", notes="before lunch")
    assert dose.units == 4.5
    assert dose.type == "rapid"
    assert dose.notes == "before lunch"


@pytest.mark.unit
def test_insulin_dose_no_notes():
    dose = InsulinDose(timestamp=NOW, units=10.0, type="long")
    assert dose.notes is None


@pytest.mark.unit
def test_meal_columns():
    meal = Meal(timestamp=NOW, carbs_g=45.0, label="Lunch", notes="pasta")
    assert meal.carbs_g == 45.0
    assert meal.label == "Lunch"
    assert meal.notes == "pasta"


@pytest.mark.unit
def test_meal_nullable_fields():
    meal = Meal(timestamp=NOW, carbs_g=20.0)
    assert meal.label is None
    assert meal.notes is None


@pytest.mark.unit
def test_health_metric_columns():
    h = HealthMetric(
        timestamp=NOW,
        heart_rate_bpm=72,
        weight_kg=75.5,
        activity_type="walking",
        activity_minutes=30,
        notes="morning walk",
    )
    assert h.heart_rate_bpm == 72
    assert h.weight_kg == 75.5
    assert h.activity_type == "walking"
    assert h.activity_minutes == 30


@pytest.mark.unit
def test_health_metric_all_nullable():
    h = HealthMetric(timestamp=NOW)
    assert h.heart_rate_bpm is None
    assert h.weight_kg is None
    assert h.activity_type is None
    assert h.activity_minutes is None
    assert h.notes is None
