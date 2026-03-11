import json
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.base import UTCDatetime
from app.schemas.glucose import GlucoseReadingOut


class MealCreate(BaseModel):
    timestamp: datetime
    carbs_g: float = Field(ge=0, le=500)
    label: str | None = None
    notes: str | None = None
    food_item_ids: list[int] | None = None


class MealOut(BaseModel):
    id: int
    timestamp: UTCDatetime
    carbs_g: float
    label: str | None
    notes: str | None
    food_item_ids: list[int] | None = None
    created_at: UTCDatetime

    model_config = {"from_attributes": True}

    @field_validator("food_item_ids", mode="before")
    @classmethod
    def parse_food_item_ids(cls, v: object) -> list[int] | None:
        if isinstance(v, str):
            try:
                return json.loads(v)  # type: ignore[no-any-return]
            except (ValueError, TypeError):
                return None
        return v  # type: ignore[return-value]


class MealListResponse(BaseModel):
    entries: list[MealOut]
    count: int


class MealResponseData(BaseModel):
    """Post-meal glucose response window (meal timestamp to +150 min)."""

    meal: MealOut
    actual_readings: list[GlucoseReadingOut]
    glucose_at_meal: int | None  # closest reading at/after meal time
