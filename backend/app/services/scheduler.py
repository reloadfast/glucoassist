import logging
from datetime import UTC, datetime

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.session import SessionLocal
from app.services.garmin_ingest import MIN_INTERVAL_SECONDS as GARMIN_MIN_INTERVAL
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
        from app.models.retrain_log import RetrainLog  # deferred to avoid circular import
        from app.services.forecasting import train_models

        result = train_models(db, trigger_source="scheduled")
        log = RetrainLog(
            triggered_at=datetime.now(UTC),
            trigger_source="scheduled",
            success=result.success,
            training_samples=result.training_samples if result.success else None,
            mae_h30=result.maes.get("h30") if result.success else None,
            mae_h60=result.maes.get("h60") if result.success else None,
            mae_h120=result.maes.get("h120") if result.success else None,
            promoted=result.promoted,
            notes=result.notes,
        )
        db.add(log)
        db.commit()
        logger.info(
            "Scheduled retrain %s",
            "completed" if result.success else "skipped (insufficient data)",
        )
    except Exception:
        logger.exception("Unhandled error in scheduled retrain job")
    finally:
        db.close()


def _garmin_job(settings: Settings) -> None:
    from app.services.garmin_ingest import run_garmin_ingest

    db: Session = SessionLocal()
    try:
        count = run_garmin_ingest(db, settings)
        if count:
            logger.info("Scheduled Garmin ingest completed: %d row inserted", count)
    except Exception:
        logger.exception("Unhandled error in scheduled Garmin ingest job")
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
        hours=settings.retrain_interval_hours,
        id="retrain_job",
        replace_existing=True,
        next_run_time=None,  # startup training handled separately in main.py
    )
    if settings.garmin_enabled:
        garmin_interval = max(settings.garmin_ingest_interval_seconds, GARMIN_MIN_INTERVAL)
        _scheduler.add_job(
            _garmin_job,
            trigger="interval",
            seconds=garmin_interval,
            args=[settings],
            id="garmin_job",
            replace_existing=True,
            next_run_time=datetime.now(UTC),
        )
        logger.info("Garmin ingest job scheduled (interval=%ds)", garmin_interval)
    _scheduler.start()
    logger.info(
        "Scheduler started (ingest=%ds, source=%s, retrain=%dh)",
        settings.ingest_interval_seconds,
        settings.cgm_source,
        settings.retrain_interval_hours,
    )


def stop_scheduler() -> None:
    global _scheduler  # noqa: PLW0603
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Ingest scheduler stopped")
    _scheduler = None
