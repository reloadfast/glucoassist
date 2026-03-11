from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.base import UTCDatetime


class InsulinDoseCreate(BaseModel):
    timestamp: datetime
    units: float = Field(gt=0, le=100)
    type: str = Field(pattern="^(rapid|long)$")
    notes: str | None = None


class InsulinDoseOut(BaseModel):
    id: int
    timestamp: UTCDatetime
    units: float
    type: str
    notes: str | None
    created_at: UTCDatetime

    model_config = {"from_attributes": True}


class InsulinListResponse(BaseModel):
    entries: list[InsulinDoseOut]
    count: int
