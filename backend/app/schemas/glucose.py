from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.base import UTCDatetime


class GlucoseReadingCreate(BaseModel):
    timestamp: datetime
    glucose_mg_dl: int = Field(ge=20, le=600)
    trend_arrow: str | None = None
    source: str = "manual"
    device_id: str | None = None


class GlucoseReadingOut(BaseModel):
    id: int
    timestamp: UTCDatetime
    glucose_mg_dl: int
    trend_arrow: str | None
    source: str
    device_id: str | None
    created_at: UTCDatetime

    model_config = {"from_attributes": True}


class GlucoseListResponse(BaseModel):
    readings: list[GlucoseReadingOut]
    count: int
