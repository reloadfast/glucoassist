from datetime import datetime

from pydantic import BaseModel, Field


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
