import threading

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.services.ingest import run_backfill

router = APIRouter(prefix="/ingest", tags=["ingest"])

_backfill_lock = threading.Lock()
_backfill_running = False


@router.post("/backfill")
def trigger_backfill(
    days: int = Query(default=90, ge=1, le=365),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> dict:
    """
    Manually trigger a historical backfill from the configured CGM source.

    Runs synchronously and returns the count of new readings inserted.
    Use `days` to control how far back to fetch (1–365, default 90).
    """
    global _backfill_running  # noqa: PLW0603
    settings = get_settings()

    with _backfill_lock:
        if _backfill_running:
            return {"status": "already_running", "inserted": 0}
        _backfill_running = True

    try:
        inserted = run_backfill(db, settings, days)
    finally:
        with _backfill_lock:
            _backfill_running = False

    return {"status": "ok", "days": days, "inserted": inserted}
