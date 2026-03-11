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
@pytest.mark.parametrize(
    "hour,expected",
    [
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
    ],
)
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
        db_session.add(
            GlucoseReading(
                timestamp=at + timedelta(minutes=30 * (i + 1)),
                glucose_mg_dl=glucose_before - 5,
                trend_arrow="Flat",
                source="nightscout",
            )
        )
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


def _seed_correction_pair(db_session, at: datetime, pre_glucose: int, nadir: int, units: float):
    """Seed a correction dose (no nearby meal) + pre/post glucose."""
    dose = InsulinDose(timestamp=at, units=units, type="rapid")
    db_session.add(dose)

    # Pre-dose readings
    for i in range(3):
        db_session.add(
            GlucoseReading(
                timestamp=at - timedelta(minutes=25 - i * 10),
                glucose_mg_dl=pre_glucose,
                trend_arrow="Flat",
                source="nightscout",
            )
        )

    # Post-dose nadir
    db_session.add(
        GlucoseReading(
            timestamp=at + timedelta(hours=2),
            glucose_mg_dl=nadir,
            trend_arrow="Flat",
            source="nightscout",
        )
    )
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
    db_session.add(
        InsulinDose(
            timestamp=now - timedelta(days=1, minutes=15),
            units=5.0,
            type="rapid",
        )
    )
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


# ── get_dose_proposal (unit) ──────────────────────────────────────────────────


from app.services.ratios import get_dose_proposal  # noqa: E402


@pytest.mark.unit
def test_dose_proposal_insufficient_data_returns_nulls(db_session):
    """Empty DB → sufficient_data=False, all dose fields None."""
    result = get_dose_proposal(db_session, hour=8, carbs_g=45.0)
    assert result.sufficient_data is False
    assert result.suggested_units is None
    assert result.suggested_units_low is None
    assert result.suggested_units_high is None
    assert result.icr is None
    assert result.block == "breakfast"


@pytest.mark.unit
def test_dose_proposal_below_min_samples(db_session):
    """Fewer than MIN_SAMPLES pairings → sufficient_data=False."""
    now = datetime.now(UTC).replace(hour=12, minute=0)
    for i in range(MIN_SAMPLES - 1):
        _seed_meal_dose_pair(db_session, at=now - timedelta(days=i + 1), carbs=60.0, units=4.0)
    result = get_dose_proposal(db_session, hour=12, carbs_g=60.0)
    assert result.sufficient_data is False


@pytest.mark.unit
def test_dose_proposal_computes_correctly(db_session):
    """MIN_SAMPLES pairings with ICR=15 → suggested dose = carbs/15."""
    now = datetime.now(UTC).replace(hour=12, minute=0)
    for i in range(MIN_SAMPLES + 1):
        _seed_meal_dose_pair(
            db_session,
            at=now - timedelta(days=i + 1),
            carbs=60.0,
            units=4.0,  # ICR = 60/4 = 15
        )
    result = get_dose_proposal(db_session, hour=12, carbs_g=60.0)
    assert result.sufficient_data is True
    assert result.suggested_units == pytest.approx(4.0, abs=0.2)
    assert result.block == "lunch"
    assert result.icr is not None
    assert result.icr.n >= MIN_SAMPLES


@pytest.mark.unit
def test_dose_proposal_range_ordering(db_session):
    """suggested_units_low ≤ suggested_units ≤ suggested_units_high."""
    now = datetime.now(UTC).replace(hour=19, minute=0)
    for i in range(MIN_SAMPLES + 2):
        units = 3.5 + (i % 3) * 0.5  # vary units to create a CI spread
        _seed_meal_dose_pair(db_session, at=now - timedelta(days=i + 1), carbs=60.0, units=units)
    result = get_dose_proposal(db_session, hour=19, carbs_g=60.0)
    assert result.sufficient_data is True
    assert result.suggested_units_low <= result.suggested_units <= result.suggested_units_high


@pytest.mark.unit
def test_dose_proposal_block_boundary_overnight(db_session):
    """Hour=5 should map to overnight block."""
    result = get_dose_proposal(db_session, hour=5, carbs_g=30.0)
    assert result.block == "overnight"


@pytest.mark.unit
def test_dose_proposal_disclaimer_always_present(db_session):
    result = get_dose_proposal(db_session, hour=8, carbs_g=45.0)
    assert len(result.disclaimer) > 10


# ── /api/v1/ratios/dose-proposal (API) ───────────────────────────────────────


@pytest.mark.asyncio
async def test_dose_proposal_endpoint_insufficient(client):
    """Empty DB → 200 with sufficient_data=False."""
    resp = await client.get("/api/v1/ratios/dose-proposal?carbs_g=45&hour=8")
    assert resp.status_code == 200
    data = resp.json()
    assert data["sufficient_data"] is False
    assert data["suggested_units"] is None
    assert "disclaimer" in data


@pytest.mark.asyncio
async def test_dose_proposal_endpoint_with_data(client, db_session):
    """Sufficient pairings → 200 with dose populated."""
    now = datetime.now(UTC).replace(hour=12, minute=0)
    for i in range(MIN_SAMPLES + 1):
        _seed_meal_dose_pair(db_session, at=now - timedelta(days=i + 1), carbs=60.0, units=4.0)
    resp = await client.get("/api/v1/ratios/dose-proposal?carbs_g=60&hour=12")
    assert resp.status_code == 200
    data = resp.json()
    assert data["sufficient_data"] is True
    assert data["suggested_units"] == pytest.approx(4.0, abs=0.3)
    assert data["suggested_units_low"] is not None
    assert data["suggested_units_high"] is not None


@pytest.mark.asyncio
async def test_dose_proposal_endpoint_zero_carbs_rejected(client):
    """carbs_g=0 should be rejected (gt=0 validation)."""
    resp = await client.get("/api/v1/ratios/dose-proposal?carbs_g=0&hour=12")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_dose_proposal_endpoint_invalid_hour(client):
    """hour=25 should be rejected (le=23 validation)."""
    resp = await client.get("/api/v1/ratios/dose-proposal?carbs_g=45&hour=25")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_dose_proposal_endpoint_days_param(client):
    resp = await client.get("/api/v1/ratios/dose-proposal?carbs_g=45&hour=8&days=30")
    assert resp.status_code == 200
    assert resp.json()["days_analyzed"] == 30
