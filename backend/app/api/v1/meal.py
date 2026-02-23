from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.meal import Meal
from app.schemas.meal import MealCreate, MealListResponse, MealOut

router = APIRouter(tags=["meal"])


@router.get("/meal", response_model=MealListResponse)
def list_meals(
    from_time: datetime | None = Query(default=None, alias="from"),
    to_time: datetime | None = Query(default=None, alias="to"),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> MealListResponse:
    q = db.query(Meal).order_by(Meal.timestamp.desc())
    if from_time:
        q = q.filter(Meal.timestamp >= from_time)
    if to_time:
        q = q.filter(Meal.timestamp <= to_time)
    entries = q.limit(limit).all()
    return MealListResponse(entries=entries, count=len(entries))


@router.post("/meal", response_model=MealOut, status_code=201)
def create_meal(payload: MealCreate, db: Session = Depends(get_db)) -> Meal:
    meal = Meal(**payload.model_dump())
    db.add(meal)
    db.commit()
    db.refresh(meal)
    return meal


@router.delete("/meal/{meal_id}", status_code=204)
def delete_meal(meal_id: int, db: Session = Depends(get_db)) -> None:
    meal = db.get(Meal, meal_id)
    if meal is None:
        raise HTTPException(status_code=404, detail="Meal not found")
    db.delete(meal)
    db.commit()
