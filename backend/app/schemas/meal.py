from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.glucose import GlucoseReadingOut


class MealCreate(BaseModel):
    timestamp: datetime
    carbs_g: float = Field(ge=0, le=500)
    label: str | None = None
    notes: str | None = None


class MealOut(BaseModel):
    id: int
    timestamp: datetime
    carbs_g: float
    label: str | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class MealListResponse(BaseModel):
    entries: list[MealOut]
    count: int


class MealResponseData(BaseModel):
    """Post-meal glucose response window (meal timestamp to +150 min)."""

    meal: MealOut
    actual_readings: list[GlucoseReadingOut]
    glucose_at_meal: int | None  # closest reading at/after meal time
