"""
Pattern detection: dawn phenomenon, basal drift, exercise sensitivity,
delayed carb absorption, stress resistance, basal misalignment,
heart-rate/glucose correlation.
"""
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


def _pearson(x: list[float], y: list[float]) -> float:
    """Pearson correlation coefficient. Returns 0.0 on degenerate input."""
    n = len(x)
    if n < 2:
        return 0.0
    mean_x = statistics.mean(x)
    mean_y = statistics.mean(y)
    cov = sum(
        (xi - mean_x) * (yi - mean_y)
        for xi, yi in zip(x, y, strict=False)
    )
    std_x = statistics.stdev(x)
    std_y = statistics.stdev(y)
    if std_x == 0 or std_y == 0:
        return 0.0
    return cov / ((n - 1) * std_x * std_y)


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
            f"Pre-dawn avg {round(mean_predawn)} → "
            f"early-morning avg {round(mean_morning)} mg/dL "
            f"(+{round(rise)} mg/dL). "
            f"{'Detected.' if detected else 'Below 20 mg/dL threshold.'}"
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
            f"Post-meal glucose peaked after 2 h in {delayed_count}/{evaluable} "
            f"logged meals. "
            f"{'Pattern detected.' if detected else 'Most peaks within normal 1–2 h window.'}"
        ),
        confidence=confidence,
    )


def _detect_stress_resistance(db: Session) -> PatternItem:
    """
    Stress-induced insulin resistance: prolonged hyperglycaemia (>180 mg/dL for ≥2 h)
    without a nearby meal or activity to explain it, and with a normal baseline 3–5 h prior.
    Uses 30-day window; requires ≥2 stress candidate events to surface the pattern.
    """
    since = datetime.now(UTC) - timedelta(days=30)
    rows = (
        db.query(GlucoseReading.timestamp, GlucoseReading.glucose_mg_dl)
        .filter(GlucoseReading.timestamp >= since)
        .order_by(GlucoseReading.timestamp)
        .all()
    )

    if len(rows) < MIN_READINGS:
        return PatternItem(
            name="Stress Insulin Resistance",
            detected=False,
            description="Insufficient CGM data to evaluate stress resistance patterns.",
            confidence=None,
        )

    # Bucket readings into 30-min slots; compute per-slot mean
    slot_avgs: dict[datetime, float] = {}
    slot_map: dict[datetime, list[int]] = defaultdict(list)
    for r in rows:
        # Truncate to nearest 30-min boundary
        ts = r.timestamp.replace(second=0, microsecond=0)
        slot = ts.replace(minute=(ts.minute // 30) * 30)
        slot_map[slot].append(r.glucose_mg_dl)
    for slot, vals in slot_map.items():
        slot_avgs[slot] = statistics.mean(vals)

    sorted_slots = sorted(slot_avgs.keys())

    # Find runs of ≥4 consecutive hyper slots (≥4 × 30 min = 2 h)
    stress_candidates = 0
    i = 0
    while i < len(sorted_slots):
        slot = sorted_slots[i]
        if slot_avgs[slot] > 180:
            # count consecutive hyper slots
            run_len = 1
            j = i + 1
            while j < len(sorted_slots) and slot_avgs[sorted_slots[j]] > 180:
                # allow up to 10-min gap between slots
                gap = (sorted_slots[j] - sorted_slots[j - 1]).total_seconds() / 60
                if gap > 40:
                    break
                run_len += 1
                j += 1
            if run_len >= 4:
                run_start = slot
                # Check no meal within 2 h before run start
                meal_window_start = run_start - timedelta(hours=2)
                nearby_meal = (
                    db.query(Meal.id)
                    .filter(
                        Meal.timestamp >= meal_window_start,
                        Meal.timestamp <= run_start,
                    )
                    .first()
                )
                # Check no activity within 2 h before run start
                nearby_activity = (
                    db.query(HealthMetric.id)
                    .filter(
                        HealthMetric.timestamp >= meal_window_start,
                        HealthMetric.timestamp <= run_start,
                        HealthMetric.activity_type.isnot(None),
                    )
                    .first()
                )
                if not nearby_meal and not nearby_activity:
                    # Check baseline 3–5 h prior is ≤160
                    baseline_start = run_start - timedelta(hours=5)
                    baseline_end = run_start - timedelta(hours=3)
                    baseline_rows = (
                        db.query(GlucoseReading.glucose_mg_dl)
                        .filter(
                            GlucoseReading.timestamp >= baseline_start,
                            GlucoseReading.timestamp < baseline_end,
                        )
                        .all()
                    )
                    if baseline_rows:
                        baseline_avg = statistics.mean(
                            r.glucose_mg_dl for r in baseline_rows
                        )
                        if baseline_avg <= 160:
                            stress_candidates += 1
            i = j
        else:
            i += 1

    if stress_candidates < 2:
        return PatternItem(
            name="Stress Insulin Resistance",
            detected=False,
            description=(
                f"Found {stress_candidates} unexplained hyperglycaemia event(s) — "
                "need ≥2 to flag stress resistance."
            ),
            confidence=None,
        )

    detected = True
    confidence = min(round(stress_candidates / 5.0, 2), 1.0)
    return PatternItem(
        name="Stress Insulin Resistance",
        detected=detected,
        description=(
            f"Detected {stress_candidates} episode(s) of prolonged hyperglycaemia "
            "(>180 mg/dL for ≥2 h) without nearby food or activity, "
            "suggesting stress-related insulin resistance."
        ),
        confidence=confidence,
    )


def _detect_basal_misalignment(db: Session) -> PatternItem:
    """
    Basal rate misalignment: consistent unidirectional overnight drift (23:00–06:00)
    across at least 5 evaluable nights (≥4 readings per night).
    Detected when ≥70% of nights trend in the same direction.
    """
    since = datetime.now(UTC) - timedelta(days=14)
    rows = (
        db.query(GlucoseReading.timestamp, GlucoseReading.glucose_mg_dl)
        .filter(GlucoseReading.timestamp >= since)
        .order_by(GlucoseReading.timestamp)
        .all()
    )

    # Group by "night key": date of the 23:00 start (prior calendar date)
    night_readings: dict[str, list[tuple[float, float]]] = defaultdict(list)
    for r in rows:
        hour = r.timestamp.hour
        if hour >= 23:
            night_key = r.timestamp.strftime("%Y-%m-%d")
        elif hour < 6:
            # Associate with previous calendar date
            prev = r.timestamp - timedelta(days=1)
            night_key = prev.strftime("%Y-%m-%d")
        else:
            continue  # outside overnight window

        # x = minutes since midnight as a float offset for OLS
        minutes = r.timestamp.hour * 60 + r.timestamp.minute
        night_readings[night_key].append((float(minutes), float(r.glucose_mg_dl)))

    evaluable_nights = 0
    pos_slope_count = 0
    neg_slope_count = 0

    for readings in night_readings.values():
        if len(readings) < 4:
            continue
        evaluable_nights += 1
        x_vals = [pt[0] for pt in readings]
        y_vals = [pt[1] for pt in readings]
        slope = _ols_slope(x_vals, y_vals)
        if slope > 0:
            pos_slope_count += 1
        else:
            neg_slope_count += 1

    if evaluable_nights < 5:
        return PatternItem(
            name="Basal Rate Misalignment",
            detected=False,
            description=(
                f"Only {evaluable_nights} evaluable overnight period(s) in past 14 days — "
                "need ≥5 to assess basal alignment."
            ),
            confidence=None,
        )

    majority = max(pos_slope_count, neg_slope_count)
    directional_fraction = majority / evaluable_nights
    detected = directional_fraction >= 0.7
    direction = "rising" if pos_slope_count >= neg_slope_count else "falling"
    confidence = round(directional_fraction, 2)

    return PatternItem(
        name="Basal Rate Misalignment",
        detected=detected,
        description=(
            f"Overnight glucose is consistently {direction} in "
            f"{majority}/{evaluable_nights} nights ({round(directional_fraction*100)}%). "
            f"{'Basal misalignment detected.' if detected else 'No consistent pattern.'}"
        ),
        confidence=confidence,
    )


def _detect_hr_glucose_correlation(db: Session) -> PatternItem:
    """
    Heart rate / glucose correlation: higher HR during activity correlates with
    greater post-activity glucose drop (Pearson r ≥ 0.4, ≥5 paired observations).
    Uses 60-day window; requires both activity_type and heart_rate_bpm to be recorded.
    """
    since = datetime.now(UTC) - timedelta(days=60)
    activities = (
        db.query(HealthMetric)
        .filter(
            HealthMetric.timestamp >= since,
            HealthMetric.activity_type.isnot(None),
            HealthMetric.heart_rate_bpm.isnot(None),
        )
        .all()
    )

    if not activities:
        return PatternItem(
            name="HR-Glucose Correlation",
            detected=False,
            description=(
                "No activity logs with heart rate found. "
                "Log heart rate alongside activity to enable this pattern."
            ),
            confidence=None,
        )

    hr_vals: list[float] = []
    drop_vals: list[float] = []

    for act in activities:
        pre_start = act.timestamp - timedelta(hours=1)
        pre_end = act.timestamp
        post_start = act.timestamp + timedelta(minutes=30)
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

        if not pre or not post:
            continue

        drop = statistics.mean(r.glucose_mg_dl for r in pre) - statistics.mean(
            r.glucose_mg_dl for r in post
        )
        hr_vals.append(float(act.heart_rate_bpm))
        drop_vals.append(drop)

    if len(hr_vals) < 5:
        return PatternItem(
            name="HR-Glucose Correlation",
            detected=False,
            description=(
                f"Only {len(hr_vals)} paired HR+glucose observation(s) — "
                "need ≥5 to compute correlation."
            ),
            confidence=None,
        )

    r = _pearson(hr_vals, drop_vals)
    detected = r >= 0.4
    confidence = round(max(r, 0.0), 2)

    return PatternItem(
        name="HR-Glucose Correlation",
        detected=detected,
        description=(
            f"Pearson r = {round(r, 2)} between heart rate and post-activity glucose drop "
            f"(n={len(hr_vals)} sessions). "
            f"{'Higher HR correlates with greater drop.' if detected else 'No clear correlation.'}"
        ),
        confidence=confidence,
    )


def detect_patterns(db: Session) -> list[PatternItem]:
    return [
        _detect_dawn_phenomenon(db),
        _detect_basal_drift(db),
        _detect_exercise_sensitivity(db),
        _detect_delayed_carb_absorption(db),
        _detect_stress_resistance(db),
        _detect_basal_misalignment(db),
        _detect_hr_glucose_correlation(db),
    ]


def update_pattern_history(db: Session, patterns: list[PatternItem]) -> None:
    """
    Upsert detected patterns into pattern_history.
    Only updates records for patterns that are currently detected.
    """
    from app.models.pattern_history import PatternHistory

    now = datetime.now(UTC)
    for p in patterns:
        if not p.detected:
            continue
        existing = (
            db.query(PatternHistory)
            .filter(PatternHistory.pattern_name == p.name)
            .first()
        )
        if existing is None:
            db.add(PatternHistory(
                pattern_name=p.name,
                first_detected_at=now,
                last_detected_at=now,
                detection_count=1,
                last_confidence=p.confidence,
            ))
        else:
            existing.last_detected_at = now
            existing.detection_count += 1
            existing.last_confidence = p.confidence
    db.commit()
