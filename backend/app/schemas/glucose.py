from datetime import datetime

from pydantic import BaseModel, Field


class GlucoseReadingCreate(BaseModel):
    timestamp: datetime
    glucose_mg_dl: int = Field(ge=20, le=600)
    trend_arrow: str | None = None
    source: str = "manual"
    device_id: str | None = None


class GlucoseReadingOut(BaseModel):
    id: int
    timestamp: datetime
    glucose_mg_dl: int
    trend_arrow: str | None
    source: str
    device_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class GlucoseListResponse(BaseModel):
    readings: list[GlucoseReadingOut]
    count: int
