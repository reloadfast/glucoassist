from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.health import HealthMetric
from app.schemas.health_metrics import HealthMetricCreate, HealthMetricListResponse, HealthMetricOut

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthMetricListResponse)
def list_health_metrics(
    from_time: datetime | None = Query(default=None, alias="from"),
    to_time: datetime | None = Query(default=None, alias="to"),
    before: datetime | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> HealthMetricListResponse:
    q = db.query(HealthMetric).order_by(HealthMetric.timestamp.desc())
    if from_time:
        q = q.filter(HealthMetric.timestamp >= from_time)
    if to_time:
        q = q.filter(HealthMetric.timestamp <= to_time)
    if before:
        q = q.filter(HealthMetric.timestamp < before)
    entries = q.limit(limit).all()
    return HealthMetricListResponse(entries=entries, count=len(entries))


@router.post("/health", response_model=HealthMetricOut, status_code=201)
def create_health_metric(
    payload: HealthMetricCreate, db: Session = Depends(get_db)
) -> HealthMetric:
    metric = HealthMetric(**payload.model_dump())
    db.add(metric)
    db.commit()
    db.refresh(metric)
    return metric


@router.delete("/health/{metric_id}", status_code=204)
def delete_health_metric(metric_id: int, db: Session = Depends(get_db)) -> None:
    metric = db.get(HealthMetric, metric_id)
    if metric is None:
        raise HTTPException(status_code=404, detail="Health metric not found")
    db.delete(metric)
    db.commit()
