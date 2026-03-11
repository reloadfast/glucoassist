from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.base import UTCDatetime


class HealthMetricCreate(BaseModel):
    timestamp: datetime
    heart_rate_bpm: int | None = Field(default=None, ge=20, le=300)
    weight_kg: float | None = Field(default=None, ge=10.0, le=500.0)
    activity_type: str | None = None
    activity_minutes: int | None = Field(default=None, ge=0, le=1440)
    sleep_hours: float | None = Field(default=None, ge=0.0, le=24.0)
    stress_level: int | None = Field(default=None, ge=0, le=100)
    notes: str | None = None


class HealthMetricOut(BaseModel):
    id: int
    timestamp: UTCDatetime
    heart_rate_bpm: int | None
    weight_kg: float | None
    activity_type: str | None
    activity_minutes: int | None
    sleep_hours: float | None
    stress_level: int | None
    source: str | None
    notes: str | None
    created_at: UTCDatetime

    model_config = {"from_attributes": True}


class HealthMetricListResponse(BaseModel):
    entries: list[HealthMetricOut]
    count: int
