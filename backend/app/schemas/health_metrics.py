from datetime import datetime

from pydantic import BaseModel, Field


class HealthMetricCreate(BaseModel):
    timestamp: datetime
    heart_rate_bpm: int | None = Field(default=None, ge=20, le=300)
    weight_kg: float | None = Field(default=None, ge=10.0, le=500.0)
    activity_type: str | None = None
    activity_minutes: int | None = Field(default=None, ge=0, le=1440)
    notes: str | None = None


class HealthMetricOut(BaseModel):
    id: int
    timestamp: datetime
    heart_rate_bpm: int | None
    weight_kg: float | None
    activity_type: str | None
    activity_minutes: int | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class HealthMetricListResponse(BaseModel):
    entries: list[HealthMetricOut]
    count: int
