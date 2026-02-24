from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.glucose import GlucoseReading
from app.schemas.summary import SummaryResponse
from app.services.iob import compute_iob

router = APIRouter(tags=["summary"])

LOW_THRESHOLD = 70
HIGH_THRESHOLD = 180


@router.get("/summary", response_model=SummaryResponse)
def get_summary(db: Session = Depends(get_db)) -> SummaryResponse:
    now = datetime.now(tz=UTC)
    since = now - timedelta(hours=24)

    latest = db.query(GlucoseReading).order_by(GlucoseReading.timestamp.desc()).first()

    readings_24h = db.query(GlucoseReading).filter(GlucoseReading.timestamp >= since).all()

    iob = compute_iob(db)

    if not readings_24h:
        return SummaryResponse(
            latest_reading=latest,
            avg_glucose=None,
            min_glucose=None,
            max_glucose=None,
            time_in_range_pct=None,
            reading_count=0,
            iob_units=iob if iob > 0 else None,
        )

    values = [r.glucose_mg_dl for r in readings_24h]
    in_range = sum(1 for v in values if LOW_THRESHOLD <= v <= HIGH_THRESHOLD)

    return SummaryResponse(
        latest_reading=latest,
        avg_glucose=round(sum(values) / len(values), 1),
        min_glucose=min(values),
        max_glucose=max(values),
        time_in_range_pct=round(in_range / len(values) * 100, 1),
        reading_count=len(values),
        iob_units=iob if iob > 0 else None,
    )
