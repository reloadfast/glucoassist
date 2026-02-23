from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.meal import Meal
from app.schemas.meal import MealCreate, MealOut

router = APIRouter(tags=["meal"])


@router.post("/meal", response_model=MealOut, status_code=201)
def create_meal(payload: MealCreate, db: Session = Depends(get_db)) -> Meal:
    meal = Meal(**payload.model_dump())
    db.add(meal)
    db.commit()
    db.refresh(meal)
    return meal
