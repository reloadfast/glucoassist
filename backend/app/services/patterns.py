"""Pattern detection: dawn phenomenon, basal drift, exercise sensitivity, delayed carb."""
import statistics
from collections import defaultdict
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.glucose import GlucoseReading
from app.models.health import HealthMetric
from app.models.meal import Meal
from app.schemas.analytics import PatternItem

# Minimum readings required before a pattern is evaluated (avoids noise)
MIN_READINGS = 5


def _ols_slope(x: list[float], y: list[float]) -> float:
    """Ordinary least squares slope for parallel x/y lists."""
    n = len(x)
    if n < 2:
        return 0.0
    mean_x = statistics.mean(x)
    mean_y = statistics.mean(y)
    num = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, y, strict=False))
    den = sum((xi - mean_x) ** 2 for xi in x)
    if den == 0:
        return 0.0
    return num / den


def _detect_dawn_phenomenon(db: Session) -> PatternItem:
    """
    Dawn phenomenon: fasting pre-dawn glucose (02:00–04:00) vs early-morning (06:00–09:00).
    Detected when the 06:00–09:00 mean is ≥20 mg/dL higher than the 02:00–04:00 mean.
    Uses readings from the past 30 days.
    """
    since = datetime.now(UTC) - timedelta(days=30)
    rows = (
        db.query(GlucoseReading.timestamp, GlucoseReading.glucose_mg_dl)
        .filter(GlucoseReading.timestamp >= since)
        .all()
    )

    predawn = [r.glucose_mg_dl for r in rows if 2 <= r.timestamp.hour < 4]
    morning = [r.glucose_mg_dl for r in rows if 6 <= r.timestamp.hour < 9]

    if len(predawn) < MIN_READINGS or len(morning) < MIN_READINGS:
        return PatternItem(
            name="Dawn Phenomenon",
            detected=False,
            description=(
                "Insufficient overnight data "
                "(need ≥5 readings in 02:00–04:00 and 06:00–09:00 windows)."
            ),
            confidence=None,
        )

    mean_predawn = statistics.mean(predawn)
    mean_morning = statistics.mean(morning)
    rise = mean_morning - mean_predawn
    detected = rise >= 20.0
    confidence = min(round(rise / 20.0, 2), 1.0) if rise > 0 else 0.0

    return PatternItem(
        name="Dawn Phenomenon",
        detected=detected,
        description=(
            f"Pre-dawn avg {round(mean_predawn)} → early-morning avg {round(mean_morning)} mg/dL "
            f"(+{round(rise)} mg/dL). {'Detected.' if detected else 'Below 20 mg/dL threshold.'}"
        ),
        confidence=confidence,
    )


def _detect_basal_drift(db: Session) -> PatternItem:
    """
    Basal drift: OLS slope of daily-average glucose over the past 14 days.
    Detected when |slope| > 2 mg/dL/day (sustained upward or downward trend).
    """
    since = datetime.now(UTC) - timedelta(days=14)
    rows = (
        db.query(GlucoseReading.timestamp, GlucoseReading.glucose_mg_dl)
        .filter(GlucoseReading.timestamp >= since)
        .order_by(GlucoseReading.timestamp)
        .all()
    )

    daily: dict[str, list[int]] = defaultdict(list)
    for r in rows:
        day_key = r.timestamp.strftime("%Y-%m-%d")
        daily[day_key].append(r.glucose_mg_dl)

    if len(daily) < 5:
        return PatternItem(
            name="Basal Drift",
            detected=False,
            description="Need ≥5 days of data in the past 14 days to assess basal drift.",
            confidence=None,
        )

    sorted_days = sorted(daily.keys())
    x = list(range(len(sorted_days)))
    y = [statistics.mean(daily[d]) for d in sorted_days]
    slope = _ols_slope(x, y)
    detected = abs(slope) > 2.0
    direction = "upward" if slope > 0 else "downward"
    confidence = min(round(abs(slope) / 5.0, 2), 1.0)

    return PatternItem(
        name="Basal Drift",
        detected=detected,
        description=(
            f"Daily glucose trending {direction} at {round(slope, 1)} mg/dL/day "
            f"over {len(sorted_days)} days. "
            f"{'Basal drift detected.' if detected else 'Slope within normal variability.'}"
        ),
        confidence=confidence,
    )


def _detect_exercise_sensitivity(db: Session) -> PatternItem:
    """
    Exercise sensitivity: compare glucose 1 h before vs 2 h after logged activity.
    Detected when post-activity glucose drops ≥20 mg/dL on average.
    """
    since = datetime.now(UTC) - timedelta(days=30)
    activities = (
        db.query(HealthMetric)
        .filter(
            HealthMetric.timestamp >= since,
            HealthMetric.activity_type.isnot(None),
        )
        .all()
    )

    if not activities:
        return PatternItem(
            name="Exercise Sensitivity",
            detected=False,
            description=(
                "No activity logs found. "
                "Log exercise via the Health metric form to enable this pattern."
            ),
            confidence=None,
        )

    drops: list[float] = []
    for act in activities:
        pre_start = act.timestamp - timedelta(hours=1)
        pre_end = act.timestamp
        post_start = act.timestamp + timedelta(hours=1)
        post_end = act.timestamp + timedelta(hours=3)

        pre = (
            db.query(GlucoseReading.glucose_mg_dl)
            .filter(
                GlucoseReading.timestamp >= pre_start,
                GlucoseReading.timestamp < pre_end,
            )
            .all()
        )
        post = (
            db.query(GlucoseReading.glucose_mg_dl)
            .filter(
                GlucoseReading.timestamp >= post_start,
                GlucoseReading.timestamp < post_end,
            )
            .all()
        )

        if pre and post:
            drop = statistics.mean(r.glucose_mg_dl for r in pre) - statistics.mean(
                r.glucose_mg_dl for r in post
            )
            drops.append(drop)

    if len(drops) < 2:
        return PatternItem(
            name="Exercise Sensitivity",
            detected=False,
            description=(
                f"Found {len(activities)} activity log(s) but insufficient "
                "glucose readings around them."
            ),
            confidence=None,
        )

    mean_drop = statistics.mean(drops)
    detected = mean_drop >= 20.0
    confidence = min(round(mean_drop / 40.0, 2), 1.0) if mean_drop > 0 else 0.0

    return PatternItem(
        name="Exercise Sensitivity",
        detected=detected,
        description=(
            f"Average glucose drop after activity: {round(mean_drop)} mg/dL "
            f"(across {len(drops)} sessions). "
            f"{'Sensitivity detected.' if detected else 'Below 20 mg/dL threshold.'}"
        ),
        confidence=confidence,
    )


def _detect_delayed_carb_absorption(db: Session) -> PatternItem:
    """
    Delayed carb absorption: glucose peak occurring 2–4 h post-meal rather than the typical 1–2 h.
    Detected when peak consistently appears after the 2 h mark.
    """
    since = datetime.now(UTC) - timedelta(days=30)
    meals = db.query(Meal).filter(Meal.timestamp >= since).all()

    if not meals:
        return PatternItem(
            name="Delayed Carb Absorption",
            detected=False,
            description="No meal logs found. Log meals to enable this pattern.",
            confidence=None,
        )

    delayed_count = 0
    evaluable = 0

    for meal in meals:
        # Collect glucose 0–4 h post-meal in 30-min buckets
        windows: dict[int, list[int]] = defaultdict(list)
        post_end = meal.timestamp + timedelta(hours=4)

        post_rows = (
            db.query(GlucoseReading.timestamp, GlucoseReading.glucose_mg_dl)
            .filter(
                GlucoseReading.timestamp >= meal.timestamp,
                GlucoseReading.timestamp < post_end,
            )
            .all()
        )

        for r in post_rows:
            delta_min = int((r.timestamp - meal.timestamp).total_seconds() / 60)
            bucket = delta_min // 30  # 0=0-30m, 1=30-60m, ..., 7=210-240m
            windows[bucket].append(r.glucose_mg_dl)

        if len(windows) < 4:
            continue  # not enough post-meal coverage

        evaluable += 1
        # Find peak bucket (0-indexed 30-min slots)
        peak_bucket = max(windows, key=lambda b: statistics.mean(windows[b]))
        # Buckets 0–3 = first 2 h; buckets 4–7 = 2–4 h (delayed)
        if peak_bucket >= 4:
            delayed_count += 1

    if evaluable < 2:
        return PatternItem(
            name="Delayed Carb Absorption",
            detected=False,
            description=(
                f"Logged {len(meals)} meal(s) but insufficient "
                "post-meal CGM coverage to evaluate."
            ),
            confidence=None,
        )

    ratio = delayed_count / evaluable
    detected = ratio >= 0.5
    confidence = round(ratio, 2)

    return PatternItem(
        name="Delayed Carb Absorption",
        detected=detected,
        description=(
            f"Post-meal glucose peaked after 2 h in {delayed_count}/{evaluable} logged meals. "
            f"{'Pattern detected.' if detected else 'Most peaks within normal 1–2 h window.'}"
        ),
        confidence=confidence,
    )


def detect_patterns(db: Session) -> list[PatternItem]:
    return [
        _detect_dawn_phenomenon(db),
        _detect_basal_drift(db),
        _detect_exercise_sensitivity(db),
        _detect_delayed_carb_absorption(db),
    ]
