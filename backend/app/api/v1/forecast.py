import logging
import threading
from datetime import UTC, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.forecast import ForecastResponse
from app.services.forecasting import _load_registry, get_forecast

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/forecast", tags=["forecast"])

_retrain_lock = threading.Lock()
_retrain_running = False


@router.get("", response_model=ForecastResponse)
def get_forecast_endpoint(db: Session = Depends(get_db)) -> ForecastResponse:  # noqa: B008
    return get_forecast(db)


@router.post("/retrain")
def trigger_retrain(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),  # noqa: B008
) -> dict:
    global _retrain_running  # noqa: PLW0603
    with _retrain_lock:
        if _retrain_running:
            return {"status": "already_running"}
        _retrain_running = True

    def _run() -> None:
        global _retrain_running  # noqa: PLW0603
        _db = None
        try:
            from app.db.session import SessionLocal
            from app.models.retrain_log import RetrainLog
            from app.services.forecasting import train_models

            _db = SessionLocal()
            result = train_models(_db, trigger_source="manual")
            log = RetrainLog(
                triggered_at=datetime.now(UTC),
                trigger_source="manual",
                success=result.success,
                training_samples=result.training_samples if result.success else None,
                mae_h30=result.maes.get("h30") if result.success else None,
                mae_h60=result.maes.get("h60") if result.success else None,
                mae_h120=result.maes.get("h120") if result.success else None,
                promoted=result.promoted,
                notes=result.notes,
            )
            _db.add(log)
            _db.commit()
        except Exception:
            logger.exception("Manual retrain failed")
        finally:
            if _db:
                _db.close()
            with _retrain_lock:
                _retrain_running = False

    background_tasks.add_task(_run)
    return {"status": "started"}


@router.get("/retrain/log")
def get_retrain_log(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),  # noqa: B008
) -> dict:
    from app.models.retrain_log import RetrainLog

    rows = db.query(RetrainLog).order_by(RetrainLog.triggered_at.desc()).limit(limit).all()
    return {
        "entries": [
            {
                "id": r.id,
                "triggered_at": r.triggered_at.isoformat(),
                "trigger_source": r.trigger_source,
                "success": r.success,
                "training_samples": r.training_samples,
                "mae_h30": r.mae_h30,
                "mae_h60": r.mae_h60,
                "mae_h120": r.mae_h120,
                "promoted": r.promoted,
                "notes": r.notes,
            }
            for r in rows
        ]
    }


@router.get("/registry")
def get_model_registry() -> dict:
    return {"versions": _load_registry()}
