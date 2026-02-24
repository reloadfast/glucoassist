from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.glucose import GlucoseReading
from app.schemas.analytics import (
    BasalWindowBlock,
    BasalWindowResponse,
    HbA1cResponse,
    PatternsResponse,
    StatsResponse,
)
from app.services.analytics import compute_window_stats
from app.services.patterns import detect_patterns, update_pattern_history

router = APIRouter(prefix="/analytics", tags=["analytics"])

WINDOWS = [30, 60, 90]


def _glucose_values(db: Session, days: int) -> list[int]:
    since = datetime.now(UTC) - timedelta(days=days)
    rows = db.query(GlucoseReading.glucose_mg_dl).filter(GlucoseReading.timestamp >= since).all()
    return [r.glucose_mg_dl for r in rows]


@router.get("/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)) -> StatsResponse:  # noqa: B008
    windows = [compute_window_stats(_glucose_values(db, w), w) for w in WINDOWS]
    return StatsResponse(windows=windows)


@router.get("/hba1c", response_model=HbA1cResponse)
def get_hba1c(db: Session = Depends(get_db)) -> HbA1cResponse:  # noqa: B008
    stats = {w: compute_window_stats(_glucose_values(db, w), w) for w in WINDOWS}
    return HbA1cResponse(
        eag_30d=stats[30].eag,
        eag_60d=stats[60].eag,
        eag_90d=stats[90].eag,
        hba1c_30d=stats[30].hba1c,
        hba1c_60d=stats[60].hba1c,
        hba1c_90d=stats[90].hba1c,
    )


@router.get("/patterns", response_model=PatternsResponse)
def get_patterns(db: Session = Depends(get_db)) -> PatternsResponse:  # noqa: B008
    patterns = detect_patterns(db)
    update_pattern_history(db, patterns)
    return PatternsResponse(patterns=patterns)


@router.get("/patterns/history")
def get_pattern_history(db: Session = Depends(get_db)) -> dict:  # noqa: B008
    from app.models.pattern_history import PatternHistory

    rows = db.query(PatternHistory).order_by(PatternHistory.last_detected_at.desc()).all()
    return {
        "history": [
            {
                "pattern_name": r.pattern_name,
                "first_detected_at": r.first_detected_at.isoformat(),
                "last_detected_at": r.last_detected_at.isoformat(),
                "detection_count": r.detection_count,
                "last_confidence": r.last_confidence,
            }
            for r in rows
        ]
    }


# 2-hour overnight blocks: (label, hour_start, hour_end) — hour_end exclusive; 24 means midnight
_BASAL_BLOCKS = [
    ("22:00–00:00", 22, 24),
    ("00:00–02:00", 0, 2),
    ("02:00–04:00", 2, 4),
    ("04:00–06:00", 4, 6),
    ("06:00–08:00", 6, 8),
]
_BASAL_DAYS = 30
_BASAL_MIN_NIGHTS = 3


def _night_date(local_date: date, local_hour: int) -> date:
    """Map a local datetime to the calendar date of the *start* of its overnight period.

    Hours 22-23 on date D → night D.
    Hours 0-7 on date D+1 → night D (grouped with the preceding evening).
    """
    return local_date if local_hour >= 22 else local_date - timedelta(days=1)  # noqa: PLR2004


@router.get("/basal-windows", response_model=BasalWindowResponse)
def get_basal_windows(  # noqa: B008
    tz: str = Query("UTC", description="IANA timezone name, e.g. Europe/London"),
    db: Session = Depends(get_db),
) -> BasalWindowResponse:
    try:
        zone = ZoneInfo(tz)
    except ZoneInfoNotFoundError as exc:
        raise HTTPException(status_code=422, detail=f"Unknown timezone: {tz}") from exc

    since = datetime.now(UTC) - timedelta(days=_BASAL_DAYS)
    rows = db.query(GlucoseReading).filter(GlucoseReading.timestamp >= since).all()

    # Bucket readings into blocks: { label -> [(night_date, glucose)] }
    buckets: dict[str, list[tuple[date, int]]] = {lbl: [] for lbl, _, _ in _BASAL_BLOCKS}

    for row in rows:
        ts_raw = row.timestamp
        ts_utc = ts_raw if ts_raw.tzinfo is not None else ts_raw.replace(tzinfo=UTC)
        ts_local = ts_utc.astimezone(zone)
        hour = ts_local.hour
        nd = _night_date(ts_local.date(), hour)

        for label, h_start, h_end in _BASAL_BLOCKS:
            if h_end == 24:  # noqa: PLR2004
                if hour >= h_start:
                    buckets[label].append((nd, row.glucose_mg_dl))
            else:
                if h_start <= hour < h_end:
                    buckets[label].append((nd, row.glucose_mg_dl))

    all_nights: set[date] = set()
    for entries in buckets.values():
        all_nights.update(nd for nd, _ in entries)

    blocks: list[BasalWindowBlock] = []
    for label, h_start, h_end in _BASAL_BLOCKS:
        entries = buckets[label]
        distinct_nights = len({nd for nd, _ in entries})
        hour_end_display = 0 if h_end == 24 else h_end  # noqa: PLR2004

        if distinct_nights < _BASAL_MIN_NIGHTS:
            blocks.append(
                BasalWindowBlock(
                    block_label=label,
                    hour_start=h_start,
                    hour_end=hour_end_display,
                    median=None,
                    p10=None,
                    p25=None,
                    p75=None,
                    p90=None,
                    n=len(entries),
                    nights=distinct_nights,
                )
            )
        else:
            arr = np.array([v for _, v in entries], dtype=float)
            blocks.append(
                BasalWindowBlock(
                    block_label=label,
                    hour_start=h_start,
                    hour_end=hour_end_display,
                    median=round(float(np.percentile(arr, 50)), 1),
                    p10=round(float(np.percentile(arr, 10)), 1),
                    p25=round(float(np.percentile(arr, 25)), 1),
                    p75=round(float(np.percentile(arr, 75)), 1),
                    p90=round(float(np.percentile(arr, 90)), 1),
                    n=len(entries),
                    nights=distinct_nights,
                )
            )

    return BasalWindowResponse(blocks=blocks, nights_analyzed=len(all_nights), tz=tz)
