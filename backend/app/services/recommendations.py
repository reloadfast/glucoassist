"""
Cross-pattern recommendation engine.

Rules are evaluated in priority order: multi-pattern combinations first
(highest specificity), then single-pattern fallbacks.  Each detected pattern
can only contribute to one recommendation — once consumed by a combo rule it
is removed from the remaining pool.
"""

from app.schemas.analytics import PatternItem, Recommendation, RecommendationsResponse

# ── Pattern name constants ────────────────────────────────────────────────────
_DAWN = "Dawn Phenomenon"
_BASAL_DRIFT = "Basal Drift"
_EXERCISE = "Exercise Sensitivity"
_DELAYED_CARB = "Delayed Carb Absorption"
_STRESS_RESIST = "Stress Insulin Resistance"
_BASAL_MISALIGN = "Basal Rate Misalignment"
_HR_GLUCOSE = "HR-Glucose Correlation"
_SLEEP_GLUCOSE = "Sleep-Glucose Correlation"
_STRESS_HYPER = "Stress-Hyperglycaemia Correlation"

_PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def _r(
    title: str,
    reasoning: str,
    action: str,
    priority: str,
    linked: list[str],
) -> Recommendation:
    return Recommendation(
        title=title,
        reasoning=reasoning,
        action=action,
        priority=priority,
        linked_patterns=linked,
    )


# ── Multi-pattern rules ───────────────────────────────────────────────────────

def _rule_dawn_and_misalignment(detected: set[str]) -> Recommendation | None:
    if _DAWN in detected and _BASAL_MISALIGN in detected:
        return _r(
            title="Overnight insulin profile needs review",
            reasoning=(
                "Your glucose rises before waking (dawn phenomenon) AND drifts "
                "consistently throughout the night — together these point to an "
                "overnight basal rate that is insufficient across multiple time windows."
            ),
            action=(
                "Discuss a targeted overnight basal adjustment with your endocrinologist. "
                "The overnight basal window analysis can help identify the exact hours "
                "where your rate falls short. A typical starting correction is +10–15% "
                "in the 1–2 h window before the rise begins."
            ),
            priority="high",
            linked=[_DAWN, _BASAL_MISALIGN],
        )
    return None


def _rule_stress_double(detected: set[str]) -> Recommendation | None:
    if _STRESS_RESIST in detected and _STRESS_HYPER in detected:
        return _r(
            title="Stress is significantly impacting your glucose control",
            reasoning=(
                "You show both unexplained hyperglycaemia episodes consistent with "
                "acute physiological stress and a statistical link between your daily "
                "stress score and time above range — confirming stress as a major driver "
                "of your high glucose events."
            ),
            action=(
                "Consider a stress correction protocol with your care team: a 10–20% "
                "temporary basal increase or a small correction bolus on objectively "
                "high-stress days. Stress-reduction strategies (sleep, exercise, "
                "breathing techniques) also reduce the insulin resistance component."
            ),
            priority="high",
            linked=[_STRESS_RESIST, _STRESS_HYPER],
        )
    return None


def _rule_exercise_and_hr(detected: set[str]) -> Recommendation | None:
    if _EXERCISE in detected and _HR_GLUCOSE in detected:
        return _r(
            title="Intense exercise causes significant glucose drops",
            reasoning=(
                "Your glucose drops substantially after activity sessions, and the "
                "magnitude of the drop correlates with exercise intensity (heart rate) — "
                "meaning higher-intensity workouts carry a meaningfully higher "
                "hypoglycaemia risk."
            ),
            action=(
                "Use heart rate zones to calibrate your response: moderate sessions "
                "(60–70% HRmax) may need only 10–15 g fast carbs beforehand, while "
                "high-intensity intervals may need 20–30 g or a 20–30% pre-activity "
                "basal reduction. Monitor for delayed hypos up to 8 hours post-exercise."
            ),
            priority="medium",
            linked=[_EXERCISE, _HR_GLUCOSE],
        )
    return None


def _rule_sleep_and_dawn(detected: set[str]) -> Recommendation | None:
    if _SLEEP_GLUCOSE in detected and _DAWN in detected:
        return _r(
            title="Poor sleep amplifies your morning glucose rise",
            reasoning=(
                "Short or poor-quality sleep correlates with higher fasting glucose, "
                "and you already show a dawn phenomenon — these two effects stack, "
                "making poorly-slept nights particularly likely to produce high "
                "morning readings."
            ),
            action=(
                "Prioritise 7–8 hours of sleep consistently. On nights you sleep "
                "poorly, check glucose on waking and consider an earlier correction "
                "or a pre-emptive small bolus if above target — discuss thresholds "
                "with your care team."
            ),
            priority="medium",
            linked=[_SLEEP_GLUCOSE, _DAWN],
        )
    return None


_COMBO_RULES = [
    _rule_dawn_and_misalignment,
    _rule_stress_double,
    _rule_exercise_and_hr,
    _rule_sleep_and_dawn,
]


# ── Single-pattern fallbacks ──────────────────────────────────────────────────

_SINGLE_RULES: dict[str, Recommendation] = {
    _DAWN: _r(
        title="Morning glucose rise likely needs a basal adjustment",
        reasoning=(
            "Your glucose consistently rises in the 04:00–09:00 window even when "
            "fasting — the classic dawn phenomenon, driven by cortisol and growth "
            "hormone surges that reduce insulin sensitivity before waking."
        ),
        action=(
            "A late-night or early-morning temporary basal rate increase — typically "
            "starting 0.5–1 h before the rise begins — is the standard correction. "
            "Discuss the timing and magnitude with your care team; small adjustments "
            "of +10–20% are a common starting point."
        ),
        priority="medium",
        linked=[_DAWN],
    ),
    _BASAL_MISALIGN: _r(
        title="Overnight basal rate is mismatched with your needs",
        reasoning=(
            "Your glucose drifts consistently in the same direction every night, "
            "indicating your current overnight basal is either too high (glucose "
            "falls) or too low (glucose rises)."
        ),
        action=(
            "Review your overnight CGM trace for the direction of drift. Adjust your "
            "overnight basal rate by 10–20% in the direction needed and monitor for "
            "3 consecutive nights before making a further adjustment."
        ),
        priority="high",
        linked=[_BASAL_MISALIGN],
    ),
    _BASAL_DRIFT: _r(
        title="Your average glucose has been trending — check for a dose mismatch",
        reasoning=(
            "Daily average glucose has been shifting over the past 14 days at a "
            "rate above normal variability, suggesting a change in insulin "
            "sensitivity, illness, activity level, or diet composition."
        ),
        action=(
            "If trending upward for more than a week, check for illness or stress, "
            "review recent diet changes, and consider a small increase to your "
            "correction factor or insulin-to-carb ratio. If trending downward, "
            "reduce ratios slightly and watch for hypoglycaemia risk."
        ),
        priority="medium",
        linked=[_BASAL_DRIFT],
    ),
    _DELAYED_CARB: _r(
        title="Carbs absorb later than expected — bolus timing is likely off",
        reasoning=(
            "Your glucose peak consistently occurs 2–4 hours after meals rather "
            "than the typical 1–2 hours, suggesting slower gastric emptying. "
            "This causes post-meal hypos (bolus peaks before food) followed by "
            "late hyperglycaemia spikes."
        ),
        action=(
            "Try splitting your meal bolus: deliver 60–70% at the start of the "
            "meal and the remaining 30–40% 60–90 minutes later. On an insulin "
            "pump, a medium-wave (combo/dual) bolus achieves this automatically. "
            "High-fat or high-protein meals often delay absorption further."
        ),
        priority="medium",
        linked=[_DELAYED_CARB],
    ),
    _STRESS_RESIST: _r(
        title="Unexplained high glucose episodes suggest stress-driven insulin resistance",
        reasoning=(
            "You have repeated episodes of prolonged hyperglycaemia (>180 mg/dL "
            "for ≥2 hours) with no nearby meal or activity to explain them — the "
            "most common cause is physiological stress, whether from illness, "
            "work pressure, or poor sleep."
        ),
        action=(
            "Keep a brief daily log of perceived stress for 2 weeks and compare "
            "it with your CGM. If they align, discuss a stress correction "
            "protocol with your care team — a small pre-emptive correction bolus "
            "or temporary basal increase on high-stress days is a common approach."
        ),
        priority="medium",
        linked=[_STRESS_RESIST],
    ),
    _SLEEP_GLUCOSE: _r(
        title="Poor sleep consistently raises your morning glucose",
        reasoning=(
            "On nights with shorter or poorer sleep, your next-morning fasting "
            "glucose is measurably higher — sleep deprivation directly reduces "
            "insulin sensitivity."
        ),
        action=(
            "Aim for 7–8 hours of consistent sleep. If a poor night is "
            "unavoidable, check glucose on waking and correct early if above "
            "target rather than waiting for breakfast."
        ),
        priority="medium",
        linked=[_SLEEP_GLUCOSE],
    ),
    _EXERCISE: _r(
        title="Exercise causes significant glucose drops — plan ahead",
        reasoning=(
            "You consistently drop ≥20 mg/dL after activity sessions. "
            "The timing and magnitude of the drop matters: aerobic exercise "
            "typically lowers glucose during and immediately after, while "
            "intense anaerobic exercise can initially raise glucose before "
            "a delayed drop."
        ),
        action=(
            "Reduce pre-activity bolus insulin by 20–30% for sessions within "
            "2 hours of a meal dose. Add 15 g fast-acting carbs before moderate "
            "sessions if starting glucose is below 120 mg/dL. Always check "
            "glucose 2 hours post-exercise for delayed hypoglycaemia."
        ),
        priority="medium",
        linked=[_EXERCISE],
    ),
    _HR_GLUCOSE: _r(
        title="Higher-intensity exercise causes larger glucose drops",
        reasoning=(
            "The harder you exercise, the larger your glucose drop — your body "
            "is particularly responsive to cardiovascular exercise intensity. "
            "This allows you to use heart rate as a proxy for expected "
            "glucose impact."
        ),
        action=(
            "For moderate sessions (60–70% HRmax), 10–15 g carbs or a 10% "
            "basal reduction is usually sufficient. For high-intensity sessions "
            "(>80% HRmax), plan for 20–30 g carbs or a 20–30% basal reduction "
            "and monitor closely for 4–6 hours after."
        ),
        priority="low",
        linked=[_HR_GLUCOSE],
    ),
    _STRESS_HYPER: _r(
        title="High-stress days reliably increase your time above range",
        reasoning=(
            "Your daily stress score (from Garmin) statistically predicts how "
            "much time you spend above 180 mg/dL — higher stress means more "
            "time hyperglycaemic, likely due to cortisol-driven insulin resistance."
        ),
        action=(
            "On days where your Garmin stress score is elevated, consider "
            "checking glucose more frequently and correcting earlier than usual. "
            "Discuss a rule-based temporary basal increase for high-stress days "
            "with your care team."
        ),
        priority="medium",
        linked=[_STRESS_HYPER],
    ),
}


# ── Engine ────────────────────────────────────────────────────────────────────

def generate_recommendations(patterns: list[PatternItem]) -> RecommendationsResponse:
    detected = {p.name for p in patterns if p.detected}
    remaining = set(detected)
    recs: list[Recommendation] = []

    # Multi-pattern rules first
    for rule_fn in _COMBO_RULES:
        rec = rule_fn(remaining)
        if rec is not None:
            recs.append(rec)
            remaining -= set(rec.linked_patterns)

    # Single-pattern fallbacks for whatever is left
    for name in list(remaining):
        if name in _SINGLE_RULES:
            recs.append(_SINGLE_RULES[name])
            remaining.discard(name)

    # Sort: high → medium → low, then by linked_patterns count desc (combos first within tier)
    recs.sort(key=lambda r: (_PRIORITY_ORDER[r.priority], -len(r.linked_patterns)))

    return RecommendationsResponse(
        recommendations=recs,
        patterns_analyzed=len(patterns),
        detected_count=len(detected),
    )
