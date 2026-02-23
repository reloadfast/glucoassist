from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.forecast import ForecastResponse
from app.services.forecasting import get_forecast

router = APIRouter(prefix="/forecast", tags=["forecast"])


@router.get("", response_model=ForecastResponse)
def get_forecast_endpoint(db: Session = Depends(get_db)) -> ForecastResponse:  # noqa: B008
    return get_forecast(db)
