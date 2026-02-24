from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.insulin import InsulinDose
from app.schemas.insulin import InsulinDoseCreate, InsulinDoseOut, InsulinListResponse

router = APIRouter(tags=["insulin"])


@router.get("/insulin", response_model=InsulinListResponse)
def list_insulin(
    from_time: datetime | None = Query(default=None, alias="from"),
    to_time: datetime | None = Query(default=None, alias="to"),
    before: datetime | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> InsulinListResponse:
    q = db.query(InsulinDose).order_by(InsulinDose.timestamp.desc())
    if from_time:
        q = q.filter(InsulinDose.timestamp >= from_time)
    if to_time:
        q = q.filter(InsulinDose.timestamp <= to_time)
    if before:
        q = q.filter(InsulinDose.timestamp < before)
    entries = q.limit(limit).all()
    return InsulinListResponse(entries=entries, count=len(entries))


@router.post("/insulin", response_model=InsulinDoseOut, status_code=201)
def create_insulin(payload: InsulinDoseCreate, db: Session = Depends(get_db)) -> InsulinDose:
    dose = InsulinDose(**payload.model_dump())
    db.add(dose)
    db.commit()
    db.refresh(dose)
    return dose


@router.delete("/insulin/{dose_id}", status_code=204)
def delete_insulin(dose_id: int, db: Session = Depends(get_db)) -> None:
    dose = db.get(InsulinDose, dose_id)
    if dose is None:
        raise HTTPException(status_code=404, detail="Insulin dose not found")
    db.delete(dose)
    db.commit()
