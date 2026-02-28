"""Unit tests for the IOB (Insulin on Board) and COB (Carbs on Board) services."""

from datetime import UTC, datetime, timedelta

import pytest

from app.models.insulin import InsulinDose
from app.models.meal import Meal
from app.services.iob import COB_DIA_MIN, RAPID_DIA_MIN, cob_fraction, compute_cob, compute_iob, iob_fraction


# ── iob_fraction ──────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_iob_fraction_at_zero_is_one() -> None:
    """Immediately after injection, 100% is still active."""
    assert iob_fraction(0.0) == 1.0


@pytest.mark.unit
def test_iob_fraction_at_dia_is_zero() -> None:
    """At the full duration of action, nothing remains."""
    assert iob_fraction(RAPID_DIA_MIN) == 0.0


@pytest.mark.unit
def test_iob_fraction_after_dia_is_zero() -> None:
    """Beyond DIA, the result is clamped to 0."""
    assert iob_fraction(RAPID_DIA_MIN + 60) == 0.0


@pytest.mark.unit
def test_iob_fraction_before_injection_is_one() -> None:
    """Negative time (dose in the future) should return 1.0."""
    assert iob_fraction(-10.0) == 1.0


@pytest.mark.unit
def test_iob_fraction_at_peak_is_between_half_and_one() -> None:
    """At peak activity (75 min), roughly 69% should still be active."""
    frac = iob_fraction(75.0)
    # 1 - (75²/(2×75)) / (240/2) = 1 - 37.5/120 = 0.6875
    assert abs(frac - 0.6875) < 0.001


@pytest.mark.unit
def test_iob_fraction_monotonically_decreasing() -> None:
    """IOB fraction must decrease (or stay flat) as time increases."""
    fracs = [iob_fraction(float(t)) for t in range(0, RAPID_DIA_MIN + 1, 15)]
    for a, b in zip(fracs, fracs[1:]):
        assert a >= b


@pytest.mark.unit
def test_iob_fraction_at_halfway() -> None:
    """At 120 min (half of 240 DIA), well over half the activity has elapsed."""
    frac = iob_fraction(120.0)
    assert 0.0 < frac < 0.5


# ── compute_iob ───────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_compute_iob_no_doses(db_session) -> None:
    """No logged insulin → IOB is 0.0."""
    result = compute_iob(db_session)
    assert result == 0.0


@pytest.mark.unit
def test_compute_iob_single_fresh_dose(db_session) -> None:
    """A fresh dose (t=0) contributes its full units to IOB."""
    now = datetime.now(UTC)
    db_session.add(InsulinDose(timestamp=now, units=4.0, type="rapid"))
    db_session.commit()

    result = compute_iob(db_session, at=now)
    assert abs(result - 4.0) < 0.01


@pytest.mark.unit
def test_compute_iob_expired_dose(db_session) -> None:
    """A dose older than DIA contributes 0 to IOB."""
    now = datetime.now(UTC)
    old = now - timedelta(minutes=RAPID_DIA_MIN + 10)
    db_session.add(InsulinDose(timestamp=old, units=6.0, type="rapid"))
    db_session.commit()

    result = compute_iob(db_session, at=now)
    assert result == 0.0


@pytest.mark.unit
def test_compute_iob_long_acting_excluded(db_session) -> None:
    """Long-acting doses are excluded from IOB."""
    now = datetime.now(UTC)
    db_session.add(InsulinDose(timestamp=now, units=20.0, type="long"))
    db_session.commit()

    result = compute_iob(db_session, at=now)
    assert result == 0.0


@pytest.mark.unit
def test_compute_iob_stacked_doses(db_session) -> None:
    """Two rapid doses stack correctly — total IOB is the sum of active fractions."""
    now = datetime.now(UTC)
    # First dose: 4 units, 2 hours ago (partially decayed)
    dose1_time = now - timedelta(minutes=120)
    # Second dose: 2 units, fresh
    db_session.add(InsulinDose(timestamp=dose1_time, units=4.0, type="rapid"))
    db_session.add(InsulinDose(timestamp=now, units=2.0, type="rapid"))
    db_session.commit()

    result = compute_iob(db_session, at=now)
    expected = 4.0 * iob_fraction(120.0) + 2.0 * iob_fraction(0.0)
    assert abs(result - round(expected, 2)) < 0.01


@pytest.mark.unit
def test_compute_iob_partial_decay(db_session) -> None:
    """A dose at peak time (75 min) retains ~69% of its units."""
    now = datetime.now(UTC)
    peak_time = now - timedelta(minutes=75)
    db_session.add(InsulinDose(timestamp=peak_time, units=4.0, type="rapid"))
    db_session.commit()

    result = compute_iob(db_session, at=now)
    expected = round(4.0 * 0.6875, 2)
    assert abs(result - expected) < 0.05


# ── cob_fraction ──────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_cob_fraction_at_zero_is_one() -> None:
    """Immediately after eating, all carbs are still active."""
    assert cob_fraction(0.0) == 1.0


@pytest.mark.unit
def test_cob_fraction_at_dia_is_zero() -> None:
    """At absorption_time, all carbs are fully absorbed."""
    assert cob_fraction(COB_DIA_MIN) == 0.0


@pytest.mark.unit
def test_cob_fraction_after_dia_is_zero() -> None:
    """Beyond absorption window, result is clamped to 0."""
    assert cob_fraction(COB_DIA_MIN + 30) == 0.0


@pytest.mark.unit
def test_cob_fraction_before_eating_is_one() -> None:
    """Negative time (meal in future) returns 1.0."""
    assert cob_fraction(-10.0) == 1.0


@pytest.mark.unit
def test_cob_fraction_midpoint() -> None:
    """At half the absorption time, exactly half the carbs remain."""
    assert abs(cob_fraction(COB_DIA_MIN / 2.0) - 0.5) < 0.001


@pytest.mark.unit
def test_cob_fraction_monotonically_decreasing() -> None:
    """COB fraction must decrease (or stay flat) as time increases."""
    fracs = [cob_fraction(float(t)) for t in range(0, COB_DIA_MIN + 1, 10)]
    for a, b in zip(fracs, fracs[1:]):
        assert a >= b


# ── compute_cob ───────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_compute_cob_no_meals(db_session) -> None:
    """No logged meals → COB is 0.0."""
    result = compute_cob(db_session)
    assert result == 0.0


@pytest.mark.unit
def test_compute_cob_fresh_meal(db_session) -> None:
    """A meal just logged contributes its full carbs to COB."""
    now = datetime.now(UTC)
    db_session.add(Meal(timestamp=now, carbs_g=60.0))
    db_session.commit()

    result = compute_cob(db_session, at=now)
    assert abs(result - 60.0) < 0.1


@pytest.mark.unit
def test_compute_cob_expired_meal(db_session) -> None:
    """A meal older than COB_DIA_MIN contributes 0 to COB."""
    now = datetime.now(UTC)
    old = now - timedelta(minutes=COB_DIA_MIN + 10)
    db_session.add(Meal(timestamp=old, carbs_g=50.0))
    db_session.commit()

    result = compute_cob(db_session, at=now)
    assert result == 0.0


@pytest.mark.unit
def test_compute_cob_partial_absorption(db_session) -> None:
    """A meal at the midpoint of absorption has ~50% of carbs remaining."""
    now = datetime.now(UTC)
    meal_time = now - timedelta(minutes=COB_DIA_MIN // 2)
    db_session.add(Meal(timestamp=meal_time, carbs_g=80.0))
    db_session.commit()

    result = compute_cob(db_session, at=now)
    assert abs(result - 40.0) < 1.0


@pytest.mark.unit
def test_compute_cob_multiple_meals(db_session) -> None:
    """Two stacked meals sum their active carbs correctly."""
    now = datetime.now(UTC)
    # Fresh meal: 60g → 60g active
    db_session.add(Meal(timestamp=now, carbs_g=60.0))
    # Half-absorbed meal: 40g at midpoint → ~20g active
    mid_time = now - timedelta(minutes=COB_DIA_MIN // 2)
    db_session.add(Meal(timestamp=mid_time, carbs_g=40.0))
    db_session.commit()

    result = compute_cob(db_session, at=now)
    assert abs(result - 80.0) < 1.0
