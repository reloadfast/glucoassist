from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.models.garmin_ingest_log import GarminIngestLog

router = APIRouter(tags=["garmin"])


@router.get("/garmin/status")
def garmin_status(settings: Settings = Depends(get_settings)) -> dict:
    return {
        "enabled": settings.garmin_enabled,
        "username_configured": bool(settings.garmin_username),
        "interval_seconds": max(settings.garmin_ingest_interval_seconds, 3600),
    }


class GarminIngestLogEntry(BaseModel):
    id: int
    run_at: datetime
    target_date: date
    outcome: str
    fields_populated: str | None
    error_detail: str | None
    retry_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class GarminIngestLogResponse(BaseModel):
    entries: list[GarminIngestLogEntry]
    count: int


@router.get("/garmin/ingest-log", response_model=GarminIngestLogResponse)
def garmin_ingest_log(
    limit: int = Query(default=30, ge=1, le=200),
    db: Session = Depends(get_db),
) -> GarminIngestLogResponse:
    rows = (
        db.query(GarminIngestLog)
        .order_by(GarminIngestLog.run_at.desc())
        .limit(limit)
        .all()
    )
    return GarminIngestLogResponse(entries=rows, count=len(rows))
