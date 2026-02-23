from fastapi import APIRouter

from app.api.v1.analytics import router as analytics_router
from app.api.v1.forecast import router as forecast_router
from app.api.v1.garmin import router as garmin_router
from app.api.v1.glucose import router as glucose_router
from app.api.v1.health_metrics import router as health_metrics_router
from app.api.v1.ingest import router as ingest_router
from app.api.v1.insulin import router as insulin_router
from app.api.v1.meal import router as meal_router
from app.api.v1.ratios import router as ratios_router
from app.api.v1.summary import router as summary_router

router = APIRouter()
router.include_router(glucose_router)
router.include_router(insulin_router)
router.include_router(meal_router)
router.include_router(health_metrics_router)
router.include_router(summary_router)
router.include_router(analytics_router)
router.include_router(ingest_router)
router.include_router(forecast_router)
router.include_router(ratios_router)
router.include_router(garmin_router)
