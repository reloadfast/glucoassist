from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.base import UTCDatetime


class FoodItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    carbs_per_100g: float = Field(ge=0, le=500)
    default_portion_g: float = Field(default=100.0, ge=1, le=2000)
    aliases: list[str] = Field(default_factory=list)


class FoodItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    carbs_per_100g: float | None = Field(default=None, ge=0, le=500)
    default_portion_g: float | None = Field(default=None, ge=1, le=2000)
    aliases: list[str] | None = None


class FoodItemOut(BaseModel):
    id: int
    name: str
    carbs_per_100g: float
    default_portion_g: float
    aliases: list[str]
    created_at: UTCDatetime
    last_used_at: UTCDatetime | None
    use_count: int

    model_config = {"from_attributes": True}


class FoodItemListResponse(BaseModel):
    items: list[FoodItemOut]
    count: int
