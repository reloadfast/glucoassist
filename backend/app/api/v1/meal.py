import json
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.food_item import FoodItem
from app.models.glucose import GlucoseReading
from app.models.meal import Meal
from app.schemas.meal import MealCreate, MealListResponse, MealOut, MealResponseData

router = APIRouter(tags=["meal"])


@router.get("/meal", response_model=MealListResponse)
def list_meals(
    from_time: datetime | None = Query(default=None, alias="from"),
    to_time: datetime | None = Query(default=None, alias="to"),
    before: datetime | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> MealListResponse:
    q = db.query(Meal).order_by(Meal.timestamp.desc())
    if from_time:
        q = q.filter(Meal.timestamp >= from_time)
    if to_time:
        q = q.filter(Meal.timestamp <= to_time)
    if before:
        q = q.filter(Meal.timestamp < before)
    entries = q.limit(limit).all()
    return MealListResponse(entries=entries, count=len(entries))


@router.post("/meal", response_model=MealOut, status_code=201)
def create_meal(payload: MealCreate, db: Session = Depends(get_db)) -> Meal:
    food_ids = payload.food_item_ids or []
    meal = Meal(
        timestamp=payload.timestamp,
        carbs_g=payload.carbs_g,
        label=payload.label,
        notes=payload.notes,
        food_item_ids=json.dumps(food_ids) if food_ids else None,
    )
    db.add(meal)

    # Update use_count and last_used_at for each referenced food item
    if food_ids:
        now = datetime.now(tz=UTC)
        for fid in food_ids:
            item = db.get(FoodItem, fid)
            if item is not None:
                item.use_count = (item.use_count or 0) + 1
                item.last_used_at = now

    db.commit()
    db.refresh(meal)
    return meal


RESPONSE_WINDOW_MIN = 150


@router.get("/meal/{meal_id}/response", response_model=MealResponseData)
def get_meal_response(meal_id: int, db: Session = Depends(get_db)) -> MealResponseData:
    """Return the glucose trace for the 150 minutes following a logged meal."""
    meal = db.get(Meal, meal_id)
    if meal is None:
        raise HTTPException(status_code=404, detail="Meal not found")
    window_end = meal.timestamp + timedelta(minutes=RESPONSE_WINDOW_MIN)
    readings = (
        db.query(GlucoseReading)
        .filter(
            GlucoseReading.timestamp >= meal.timestamp,
            GlucoseReading.timestamp <= window_end,
        )
        .order_by(GlucoseReading.timestamp.asc())
        .all()
    )
    glucose_at_meal = readings[0].glucose_mg_dl if readings else None
    return MealResponseData(meal=meal, actual_readings=readings, glucose_at_meal=glucose_at_meal)


@router.delete("/meal/{meal_id}", status_code=204)
def delete_meal(meal_id: int, db: Session = Depends(get_db)) -> None:
    meal = db.get(Meal, meal_id)
    if meal is None:
        raise HTTPException(status_code=404, detail="Meal not found")
    db.delete(meal)
    db.commit()
