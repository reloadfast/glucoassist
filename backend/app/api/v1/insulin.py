from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.insulin import InsulinDose
from app.schemas.insulin import InsulinDoseCreate, InsulinDoseOut

router = APIRouter(tags=["insulin"])


@router.post("/insulin", response_model=InsulinDoseOut, status_code=201)
def create_insulin(payload: InsulinDoseCreate, db: Session = Depends(get_db)) -> InsulinDose:
    dose = InsulinDose(**payload.model_dump())
    db.add(dose)
    db.commit()
    db.refresh(dose)
    return dose
