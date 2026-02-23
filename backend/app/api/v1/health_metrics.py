from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.health import HealthMetric
from app.schemas.health_metrics import HealthMetricCreate, HealthMetricOut

router = APIRouter(tags=["health"])


@router.post("/health", response_model=HealthMetricOut, status_code=201)
def create_health_metric(
    payload: HealthMetricCreate, db: Session = Depends(get_db)
) -> HealthMetric:
    metric = HealthMetric(**payload.model_dump())
    db.add(metric)
    db.commit()
    db.refresh(metric)
    return metric
