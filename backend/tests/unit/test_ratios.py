"""Unit tests for ICR/CF ratio estimation service."""
from datetime import UTC, datetime, timedelta

import pytest

from app.models.glucose import GlucoseReading
from app.models.insulin import InsulinDose
from app.models.meal import Meal
from app.services.ratios import (
    MIN_SAMPLES,
    _block_for_hour,
    _ci,
    compute_ratios,
)

# ── _block_for_hour ───────────────────────────────────────────────────────────

@pytest.mark.unit
@pytest.mark.parametrize("hour,expected", [
    (0, "overnight"),
    (3, "overnight"),
    (5, "overnight"),
    (6, "breakfast"),
    (9, "breakfast"),
    (10, "breakfast"),
    (11, "lunch"),
    (13, "lunch"),
    (14, "lunch"),
    (15, "dinner"),
    (20, "dinner"),
    (23, "dinner"),
])
def test_block_for_hour(hour, expected):
    assert _block_for_hour(hour) == expected


# ── _ci ───────────────────────────────────────────────────────────────────────

@pytest.mark.unit
def test_ci_single_sample():
    result = _ci([10.0])
    assert result.mean == pytest.approx(10.0)
    assert result.ci_lower == pytest.approx(10.0)
    assert result.ci_upper == pytest.approx(10.0)
    assert result.n == 1


@pytest.mark.unit
def test_ci_multiple_samples():
    samples = [8.0, 10.0, 12.0, 9.0, 11.0, 10.0]
    result = _ci(samples)
    assert result.ci_lower <= result.mean <= result.ci_upper
    assert result.n == 6


# ── compute_ratios empty DB ───────────────────────────────────────────────────

@pytest.mark.unit
def test_compute_ratios_empty_db(db_session):
    result = compute_ratios(db_session, days=90)
    assert len(result["blocks"]) == 4
    for block in result["blocks"]:
        assert block["icr"] is None
        assert block["cf"] is None
        assert block["insufficient_data"] is True


# ── ICR computation ───────────────────────────────────────────────────────────

def _seed_meal_dose_pair(
    db_session, at: datetime, carbs: float, units: float, glucose_before: int = 130
):
    """Seed a meal + rapid dose + pre/post glucose readings."""
    meal = Meal(timestamp=at, carbs_g=carbs)
    dose = InsulinDose(timestamp=at - timedelta(minutes=10), units=units, type="rapid")
    db_session.add(meal)
    db_session.add(dose)

    # 4 post-meal glucose readings
    for i in range(4):
        db_session.add(GlucoseReading(
            timestamp=at + timedelta(minutes=30 * (i + 1)),
            glucose_mg_dl=glucose_before - 5,
            trend_arrow="Flat",
            source="nightscout",
        ))
    db_session.commit()


@pytest.mark.unit
def test_icr_insufficient_below_threshold(db_session):
    """Fewer than MIN_SAMPLES pairings → icr is None."""
    now = datetime.now(UTC).replace(hour=8, minute=0)
    for i in range(MIN_SAMPLES - 1):
        _seed_meal_dose_pair(
            db_session,
            at=now - timedelta(days=i + 1),
            carbs=50.0,
            units=5.0,
        )
    result = compute_ratios(db_session, days=90)
    breakfast = next(b for b in result["blocks"] if b["block"] == "breakfast")
    assert breakfast["icr"] is None


@pytest.mark.unit
def test_icr_computed_with_sufficient_data(db_session):
    """MIN_SAMPLES+ pairings at breakfast time → icr is populated."""
    now = datetime.now(UTC).replace(hour=8, minute=0)
    for i in range(MIN_SAMPLES + 1):
        _seed_meal_dose_pair(
            db_session,
            at=now - timedelta(days=i + 1),
            carbs=60.0,
            units=4.0,  # ICR = 15
        )
    result = compute_ratios(db_session, days=90)
    breakfast = next(b for b in result["blocks"] if b["block"] == "breakfast")
    assert breakfast["icr"] is not None
    assert breakfast["icr"].mean == pytest.approx(15.0, abs=0.1)


# ── CF computation ────────────────────────────────────────────────────────────

def _seed_correction_pair(
    db_session, at: datetime, pre_glucose: int, nadir: int, units: float
):
    """Seed a correction dose (no nearby meal) + pre/post glucose."""
    dose = InsulinDose(timestamp=at, units=units, type="rapid")
    db_session.add(dose)

    # Pre-dose readings
    for i in range(3):
        db_session.add(GlucoseReading(
            timestamp=at - timedelta(minutes=25 - i * 10),
            glucose_mg_dl=pre_glucose,
            trend_arrow="Flat",
            source="nightscout",
        ))

    # Post-dose nadir
    db_session.add(GlucoseReading(
        timestamp=at + timedelta(hours=2),
        glucose_mg_dl=nadir,
        trend_arrow="Flat",
        source="nightscout",
    ))
    db_session.commit()


@pytest.mark.unit
def test_cf_insufficient_when_no_correction_doses(db_session):
    result = compute_ratios(db_session, days=90)
    for block in result["blocks"]:
        assert block["cf"] is None


@pytest.mark.unit
def test_cf_excludes_dose_near_meal(db_session):
    """Rapid dose with a nearby meal should NOT be counted as correction."""
    now = datetime.now(UTC).replace(hour=12)
    # Add a meal and dose close together
    db_session.add(Meal(timestamp=now - timedelta(days=1), carbs_g=50))
    db_session.add(InsulinDose(
        timestamp=now - timedelta(days=1, minutes=15),
        units=5.0,
        type="rapid",
    ))
    db_session.commit()
    result = compute_ratios(db_session, days=90)
    lunch = next(b for b in result["blocks"] if b["block"] == "lunch")
    assert lunch["cf"] is None


# ── API integration ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_ratios_endpoint_empty(client):
    resp = await client.get("/api/v1/ratios")
    assert resp.status_code == 200
    data = resp.json()
    assert "blocks" in data
    assert "disclaimer" in data
    assert data["days_analyzed"] == 90
    for block in data["blocks"]:
        assert block["insufficient_data"] is True


@pytest.mark.asyncio
async def test_ratios_endpoint_days_param(client):
    resp = await client.get("/api/v1/ratios?days=30")
    assert resp.status_code == 200
    assert resp.json()["days_analyzed"] == 30


@pytest.mark.asyncio
async def test_ratios_endpoint_disclaimer_always_present(client):
    resp = await client.get("/api/v1/ratios")
    assert len(resp.json()["disclaimer"]) > 10
