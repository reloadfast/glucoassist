import logging
from datetime import UTC, datetime

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.session import SessionLocal
from app.services.ingest import run_ingest

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def _ingest_job(settings: Settings) -> None:
    db: Session = SessionLocal()
    try:
        count = run_ingest(db, settings)
        logger.info("Scheduled ingest completed: %d new readings inserted", count)
    except Exception:
        logger.exception("Unhandled error in scheduled ingest job")
    finally:
        db.close()


def _retrain_job() -> None:
    db: Session = SessionLocal()
    try:
        from app.services.forecasting import train_models  # deferred to avoid circular import

        success = train_models(db)
        logger.info(
            "Scheduled retrain %s", "completed" if success else "skipped (insufficient data)"
        )
    except Exception:
        logger.exception("Unhandled error in scheduled retrain job")
    finally:
        db.close()


def start_scheduler(settings: Settings) -> None:
    global _scheduler  # noqa: PLW0603
    _scheduler = BackgroundScheduler()
    _scheduler.add_job(
        _ingest_job,
        trigger="interval",
        seconds=settings.ingest_interval_seconds,
        args=[settings],
        id="ingest_job",
        replace_existing=True,
        next_run_time=datetime.now(UTC),  # run immediately on startup
    )
    _scheduler.add_job(
        _retrain_job,
        trigger="interval",
        hours=24,
        id="retrain_job",
        replace_existing=True,
        next_run_time=None,  # startup training handled separately in main.py
    )
    _scheduler.start()
    logger.info(
        "Scheduler started (ingest=%ds, source=%s, retrain=24h)",
        settings.ingest_interval_seconds,
        settings.cgm_source,
    )


def stop_scheduler() -> None:
    global _scheduler  # noqa: PLW0603
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Ingest scheduler stopped")
    _scheduler = None
