import logging
import threading
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.core.config import get_settings
from app.core.logger import setup_logging

logger = logging.getLogger(__name__)


def _maybe_train_models() -> None:
    """Run in a background thread: train forecast models if not yet persisted."""
    from app.db.session import SessionLocal
    from app.services.forecasting import models_exist, train_models

    if models_exist():
        logger.info("Forecasting: models already exist — skipping startup training")
        return

    db = SessionLocal()
    try:
        logger.info("Forecasting: no models found — starting initial training")
        train_models(db)
    except Exception:
        logger.exception("Forecasting: unhandled error during startup training")
    finally:
        db.close()


def _maybe_backfill(settings) -> None:  # type: ignore[type-arg]
    """Run in a background thread: backfill history if DB is empty and configured."""
    from app.db.session import SessionLocal
    from app.models.glucose import GlucoseReading
    from app.services.ingest import run_backfill

    if settings.backfill_days <= 0:
        return

    db = SessionLocal()
    try:
        count = db.query(GlucoseReading).count()
        if count > 0:
            logger.info("Backfill: DB already has %d readings — skipping auto-backfill", count)
            return
        logger.info(
            "Backfill: DB is empty — starting %d-day historical import",
            settings.backfill_days,
        )
        run_backfill(db, settings, settings.backfill_days)
    except Exception:
        logger.exception("Backfill: unhandled error during startup backfill")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    settings = get_settings()
    setup_logging(settings.app_env)

    from app.db.engine import init_db
    from app.services.scheduler import start_scheduler, stop_scheduler

    init_db()
    start_scheduler(settings)

    # Kick off historical backfill in background so it doesn't block startup
    threading.Thread(target=_maybe_backfill, args=(settings,), daemon=True, name="backfill").start()
    # Train forecast models if not yet present
    threading.Thread(target=_maybe_train_models, daemon=True, name="train_models").start()

    yield
    stop_scheduler()


def create_app() -> FastAPI:
    settings = get_settings()

    application = FastAPI(
        title="GlucoAssist",
        version="0.1.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        description=(
            "Personal diabetes predictive intelligence system. "
            "Ingests CGM data from a local nightscout-librelink-up or Nightscout instance "
            "and provides glucose trend analysis, HbA1c projection, pattern detection, "
            "and 30/60/120-minute glucose forecasting.\n\n"
            "> **Not a medical device. Decision-support only — no autonomous dosing.**"
        ),
        lifespan=lifespan,
        openapi_tags=[
            {"name": "glucose", "description": "CGM glucose readings — store and query raw entries"},
            {"name": "insulin", "description": "Insulin dose log"},
            {"name": "meal", "description": "Meal and carbohydrate log"},
            {"name": "health", "description": "Health metrics (heart rate, weight, sleep, stress)"},
            {"name": "summary", "description": "Current glucose snapshot and rolling statistics"},
            {"name": "analytics", "description": "HbA1c projection, time-in-range, and detected patterns"},
            {"name": "forecast", "description": "30/60/120-minute glucose forecast and risk estimate"},
            {"name": "ratios", "description": "Insulin-to-carb ratio and correction factor estimates"},
            {"name": "ingest", "description": "Manual ingest trigger and ingest status"},
            {"name": "garmin", "description": "Garmin Connect integration status and manual sync"},
        ],
    )

    # CORS
    if settings.app_env == "development":
        allow_origins = ["*"]
    else:
        allow_origins = []  # restrict to same-origin in production (behind Nginx)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(health_router, prefix="/api")

    from app.api import router as api_router

    application.include_router(api_router)

    return application


app = create_app()
