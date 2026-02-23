from fastapi import APIRouter

from app.api.v1.glucose import router as glucose_router
from app.api.v1.health_metrics import router as health_metrics_router
from app.api.v1.insulin import router as insulin_router
from app.api.v1.meal import router as meal_router
from app.api.v1.summary import router as summary_router

router = APIRouter()
router.include_router(glucose_router)
router.include_router(insulin_router)
router.include_router(meal_router)
router.include_router(health_metrics_router)
router.include_router(summary_router)
