"""
Insulin-to-Carb Ratio (ICR) and Correction Factor (CF) estimator.

Pairs meal + rapid-insulin logs to derive per-time-block ICR.
Pairs correction rapid-insulin (no nearby meal) to derive per-time-block CF.
Confidence intervals via standard-error formula (stdlib only, no scipy).

Time blocks:
  overnight:  00:00–05:59
  breakfast:  06:00–10:59
  lunch:      11:00–14:59
  dinner:     15:00–23:59
"""

import math
import statistics
from datetime import UTC, datetime, timedelta
from typing import NamedTuple

from sqlalchemy.orm import Session

from app.models.glucose import GlucoseReading
from app.models.insulin import InsulinDose
from app.models.meal import Meal
from app.schemas.ratios import DoseProposalResponse

MIN_SAMPLES = 5  # minimum paired observations per block before surfacing estimate
MEAL_WINDOW_MIN = 30  # ±minutes to associate a rapid dose with a meal
CORRECTION_GAP_MIN = 60  # no meal within this window → correction dose
RESPONSE_HOURS = 3  # post-event glucose observation window
Z90 = 1.645  # z-score for 90% CI

TIME_BLOCKS: dict[str, tuple[int, int]] = {
    "overnight": (0, 6),
    "breakfast": (6, 11),
    "lunch": (11, 15),
    "dinner": (15, 24),
}


class RatioEstimate(NamedTuple):
    mean: float
    ci_lower: float
    ci_upper: float
    n: int


def _block_for_hour(hour: int) -> str:
    for name, (start, end) in TIME_BLOCKS.items():
        if start <= hour < end:
            return name
    return "dinner"


def _mean_glucose(db: Session, start: datetime, end: datetime) -> float | None:
    rows = (
        db.query(GlucoseReading.glucose_mg_dl)
        .filter(
            GlucoseReading.timestamp >= start,
            GlucoseReading.timestamp < end,
        )
        .all()
    )
    if not rows:
        return None
    return statistics.mean(r.glucose_mg_dl for r in rows)


def _min_glucose(db: Session, start: datetime, end: datetime) -> float | None:
    rows = (
        db.query(GlucoseReading.glucose_mg_dl)
        .filter(
            GlucoseReading.timestamp >= start,
            GlucoseReading.timestamp < end,
        )
        .all()
    )
    if not rows:
        return None
    return float(min(r.glucose_mg_dl for r in rows))


def _ci(samples: list[float]) -> RatioEstimate:
    n = len(samples)
    mu = statistics.mean(samples)
    if n < 2:
        return RatioEstimate(mean=round(mu, 2), ci_lower=round(mu, 2), ci_upper=round(mu, 2), n=n)
    std = statistics.stdev(samples)
    half = Z90 * std / math.sqrt(n)
    return RatioEstimate(
        mean=round(mu, 2),
        ci_lower=round(mu - half, 2),
        ci_upper=round(mu + half, 2),
        n=n,
    )


def _collect_icr_samples(db: Session, since: datetime) -> dict[str, list[float]]:
    """
    For each meal, find the closest rapid dose within ±MEAL_WINDOW_MIN.
    Yield carbs_g / insulin_units for pairings with ≥3 post-meal glucose readings.
    """
    meals = db.query(Meal).filter(Meal.timestamp >= since).all()
    samples: dict[str, list[float]] = {k: [] for k in TIME_BLOCKS}

    for meal in meals:
        if meal.carbs_g <= 0:
            continue
        window_start = meal.timestamp - timedelta(minutes=MEAL_WINDOW_MIN)
        window_end = meal.timestamp + timedelta(minutes=MEAL_WINDOW_MIN)

        doses = (
            db.query(InsulinDose)
            .filter(
                InsulinDose.timestamp >= window_start,
                InsulinDose.timestamp <= window_end,
                InsulinDose.type == "rapid",
            )
            .all()
        )
        if not doses:
            continue

        total_units = sum(d.units for d in doses)
        if total_units <= 0:
            continue

        # Require ≥3 post-meal glucose readings for coverage
        post_end = meal.timestamp + timedelta(hours=RESPONSE_HOURS)
        post_count = (
            db.query(GlucoseReading.id)
            .filter(
                GlucoseReading.timestamp >= meal.timestamp,
                GlucoseReading.timestamp < post_end,
            )
            .count()
        )
        if post_count < 3:
            continue

        icr_obs = meal.carbs_g / total_units
        block = _block_for_hour(meal.timestamp.hour)
        samples[block].append(icr_obs)

    return samples


def _collect_cf_samples(db: Session, since: datetime) -> dict[str, list[float]]:
    """
    For each rapid dose with NO meal within CORRECTION_GAP_MIN,
    compute glucose drop: pre_avg - nadir over RESPONSE_HOURS.
    CF observation = drop / units.
    """
    doses = (
        db.query(InsulinDose)
        .filter(
            InsulinDose.timestamp >= since,
            InsulinDose.type == "rapid",
        )
        .all()
    )
    samples: dict[str, list[float]] = {k: [] for k in TIME_BLOCKS}

    for dose in doses:
        gap_start = dose.timestamp - timedelta(minutes=CORRECTION_GAP_MIN)
        gap_end = dose.timestamp + timedelta(minutes=CORRECTION_GAP_MIN)

        nearby_meals = (
            db.query(Meal.id)
            .filter(
                Meal.timestamp >= gap_start,
                Meal.timestamp <= gap_end,
            )
            .count()
        )
        if nearby_meals > 0:
            continue

        pre_start = dose.timestamp - timedelta(minutes=30)
        pre_avg = _mean_glucose(db, pre_start, dose.timestamp)
        if pre_avg is None:
            continue

        post_end = dose.timestamp + timedelta(hours=RESPONSE_HOURS)
        nadir = _min_glucose(db, dose.timestamp, post_end)
        if nadir is None:
            continue

        drop = pre_avg - nadir
        if drop <= 0:
            continue

        cf_obs = drop / dose.units
        block = _block_for_hour(dose.timestamp.hour)
        samples[block].append(cf_obs)

    return samples


def compute_ratios(db: Session, days: int = 90) -> dict[str, object]:
    """
    Returns a dict with 'icr_samples', 'cf_samples', and 'blocks' list.
    Each block entry includes raw sample counts and optional estimates.
    """
    since = datetime.now(UTC) - timedelta(days=days)
    icr_samples = _collect_icr_samples(db, since)
    cf_samples = _collect_cf_samples(db, since)

    blocks = []
    for block in TIME_BLOCKS:
        icr_list = icr_samples[block]
        cf_list = cf_samples[block]
        icr_est = _ci(icr_list) if len(icr_list) >= MIN_SAMPLES else None
        cf_est = _ci(cf_list) if len(cf_list) >= MIN_SAMPLES else None
        blocks.append(
            {
                "block": block,
                "icr": icr_est,
                "cf": cf_est,
                "icr_samples": len(icr_list),
                "cf_samples": len(cf_list),
                "insufficient_data": (len(icr_list) < MIN_SAMPLES and len(cf_list) < MIN_SAMPLES),
            }
        )
    return {"blocks": blocks}


_DOSE_DISCLAIMER = (
    "Dose proposal is for decision-support only — always follow guidance "
    "from your healthcare team."
)


def get_dose_proposal(
    db: Session,
    hour: int,
    carbs_g: float,
    days: int = 90,
) -> DoseProposalResponse:
    """
    Compute a suggested bolus dose for a given carb amount and hour of day.

    Uses the ICR for the relevant time block.  Returns sufficient_data=False
    when fewer than MIN_SAMPLES pairings exist for that block.
    """
    since = datetime.now(UTC) - timedelta(days=days)
    icr_samples = _collect_icr_samples(db, since)
    block = _block_for_hour(hour)
    block_samples = icr_samples[block]

    if len(block_samples) < MIN_SAMPLES:
        return DoseProposalResponse(
            block=block,
            icr=None,
            suggested_units=None,
            suggested_units_low=None,
            suggested_units_high=None,
            sufficient_data=False,
            days_analyzed=days,
            disclaimer=_DOSE_DISCLAIMER,
        )

    icr_est = _ci(block_samples)

    from app.schemas.ratios import RatioEstimate as SchemaRatioEstimate

    suggested = round(carbs_g / icr_est.mean, 1)
    # Dividing by CI upper (larger ICR → fewer units) gives the lower bound
    suggested_low = round(carbs_g / icr_est.ci_upper, 1) if icr_est.ci_upper > 0 else suggested
    # Dividing by CI lower (smaller ICR → more units) gives the upper bound
    suggested_high = round(carbs_g / icr_est.ci_lower, 1) if icr_est.ci_lower > 0 else suggested

    return DoseProposalResponse(
        block=block,
        icr=SchemaRatioEstimate(
            mean=icr_est.mean,
            ci_lower=icr_est.ci_lower,
            ci_upper=icr_est.ci_upper,
            n=icr_est.n,
        ),
        suggested_units=suggested,
        suggested_units_low=suggested_low,
        suggested_units_high=suggested_high,
        sufficient_data=True,
        days_analyzed=days,
        disclaimer=_DOSE_DISCLAIMER,
    )
