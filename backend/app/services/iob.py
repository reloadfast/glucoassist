"""
Insulin on Board (IOB) calculation service.

Uses a bilinear (trapezoid) activity model — the standard approximation used by
open-source closed-loop systems (Loop, OpenAPS, AndroidAPS).

Activity curve:
  - Rises linearly from 0 → 1 over [0, PEAK_MIN]
  - Falls linearly from 1 → 0 over [PEAK_MIN, DIA_MIN]

IOB(t) = 1 - [area under activity curve from 0 to t] / [total area under curve]

Default parameters (rapid-acting: Humalog / NovoRapid / Fiasp):
  DIA  = 240 min  (duration of insulin action)
  PEAK =  75 min  (time to peak activity)

Long-acting doses are excluded — their effect is represented in the basal glucose
baseline and has negligible intra-hour variation.

This is a decision-support approximation only — not a medical calculation.
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.insulin import InsulinDose

RAPID_DIA_MIN: int = 240  # duration of action in minutes
RAPID_PEAK_MIN: int = 75  # time to peak activity in minutes


def iob_fraction(
    t_min: float,
    dia: float = RAPID_DIA_MIN,
    peak: float = RAPID_PEAK_MIN,
) -> float:
    """
    Fraction of a rapid-acting insulin dose still physiologically active
    *t_min* minutes after injection.  Returns a value in [0.0, 1.0].

    Bilinear activity model (trapezoid):
      a(s) = s / peak             for s in [0, peak]        (rising phase)
      a(s) = (dia - s)/(dia - peak)  for s in [peak, dia]  (falling phase)

    IOB(t) = 1 - integral(a, 0, t) / integral(a, 0, dia)

    Closed-form integrals:
      Rising  (t <= peak): elapsed = t² / (2 × peak)
      Falling (t >  peak): elapsed = peak/2 + [(dia-peak)² - (dia-t)²] / (2×(dia-peak))
      Total area           = dia / 2
    """
    if t_min <= 0.0:
        return 1.0
    if t_min >= dia:
        return 0.0

    total_area = dia / 2.0

    if t_min <= peak:
        elapsed = t_min**2 / (2.0 * peak)
    else:
        rising_area = peak / 2.0
        falling_area = ((dia - peak) ** 2 - (dia - t_min) ** 2) / (2.0 * (dia - peak))
        elapsed = rising_area + falling_area

    return max(0.0, 1.0 - elapsed / total_area)


def compute_iob(db: Session, at: datetime | None = None) -> float:
    """
    Sum of active rapid-acting insulin (units) across all doses logged within
    the last DIA minutes.

    Parameters
    ----------
    db : SQLAlchemy session
    at : reference timestamp (defaults to now UTC)

    Returns
    -------
    float
        Total active insulin in units, rounded to 2 decimal places.
        Returns 0.0 when no rapid doses are present in the active window.
    """
    now = at if at is not None else datetime.now(UTC)
    cutoff = now - timedelta(minutes=RAPID_DIA_MIN)

    doses = (
        db.query(InsulinDose)
        .filter(
            InsulinDose.type == "rapid",
            InsulinDose.timestamp >= cutoff,
            InsulinDose.timestamp <= now,
        )
        .all()
    )

    total = 0.0
    for dose in doses:
        dose_ts = dose.timestamp
        if dose_ts.tzinfo is None:
            dose_ts = dose_ts.replace(tzinfo=UTC)
        t_min = (now - dose_ts).total_seconds() / 60.0
        total += dose.units * iob_fraction(t_min)

    return round(total, 2)
