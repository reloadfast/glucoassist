from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.glucose import GlucoseReading
from app.schemas.glucose import GlucoseListResponse, GlucoseReadingCreate, GlucoseReadingOut

router = APIRouter(tags=["glucose"])


@router.get("/glucose", response_model=GlucoseListResponse)
def list_glucose(
    from_time: datetime | None = Query(default=None, alias="from"),
    to_time: datetime | None = Query(default=None, alias="to"),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> GlucoseListResponse:
    q = db.query(GlucoseReading).order_by(GlucoseReading.timestamp.desc())
    if from_time:
        q = q.filter(GlucoseReading.timestamp >= from_time)
    if to_time:
        q = q.filter(GlucoseReading.timestamp <= to_time)
    readings = q.limit(limit).all()
    return GlucoseListResponse(readings=readings, count=len(readings))


@router.post("/glucose", response_model=GlucoseReadingOut, status_code=201)
def create_glucose(payload: GlucoseReadingCreate, db: Session = Depends(get_db)) -> GlucoseReading:
    reading = GlucoseReading(**payload.model_dump())
    db.add(reading)
    db.commit()
    db.refresh(reading)
    return reading
