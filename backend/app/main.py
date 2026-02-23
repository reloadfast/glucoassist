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

    yield
    stop_scheduler()


def create_app() -> FastAPI:
    settings = get_settings()

    application = FastAPI(
        title="GlucoSense",
        version="0.1.0",
        lifespan=lifespan,
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
