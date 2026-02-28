from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.models.glucose import GlucoseReading
from app.services.ingest import push_entries

router = APIRouter(tags=["ingest"])

# Nightscout direction string → trend integer
_DIRECTION_TO_INT: dict[str, int] = {
    "DoubleUp": 1,
    "SingleUp": 2,
    "FortyFiveUp": 3,
    "Flat": 4,
    "FortyFiveDown": 5,
    "SingleDown": 6,
    "DoubleDown": 7,
}


def _check_push_secret(api_secret: str | None = Header(default=None, alias="API-SECRET")) -> None:
    """Dependency: validate API-SECRET header when PUSH_SECRET is configured."""
    settings = get_settings()
    secret = settings.push_secret
    if not secret:
        return  # auth disabled — open access
    if api_secret != secret:
        raise HTTPException(status_code=401, detail="Unauthorized")


def _reading_to_ns(r: GlucoseReading) -> dict:
    """Convert a GlucoseReading row to a Nightscout SGV dict."""
    ts = r.timestamp
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=UTC)
    date_ms = int(ts.timestamp() * 1000)
    direction = r.trend_arrow or "Flat"
    return {
        "_id": f"{r.id:024x}",
        "type": "sgv",
        "sgv": r.glucose_mg_dl,
        "date": date_ms,
        "dateString": ts.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        "trend": _DIRECTION_TO_INT.get(direction, 4),
        "direction": direction,
        "device": r.device_id or "GlucoAssist",
    }


@router.get("/entries", dependencies=[Depends(_check_push_secret)])
def get_entries(
    count: int = Query(default=10, ge=1, le=1000),
    find_gte: int | None = Query(default=None, alias="find[date][$gte]"),
    find_lte: int | None = Query(default=None, alias="find[date][$lte]"),
    db: Session = Depends(get_db),  # noqa: B008
) -> list[dict]:
    """
    Nightscout-compatible entries query.

    Returns up to ``count`` SGV readings newest-first.  Supports epoch-ms
    date range filters via ``find[date][$gte]`` and ``find[date][$lte]``.
    """
    q = db.query(GlucoseReading)
    if find_gte is not None:
        ts_gte = datetime.fromtimestamp(find_gte / 1000.0, tz=UTC).replace(tzinfo=None)
        q = q.filter(GlucoseReading.timestamp >= ts_gte)
    if find_lte is not None:
        ts_lte = datetime.fromtimestamp(find_lte / 1000.0, tz=UTC).replace(tzinfo=None)
        q = q.filter(GlucoseReading.timestamp <= ts_lte)
    rows = q.order_by(GlucoseReading.timestamp.desc()).limit(count).all()
    return [_reading_to_ns(r) for r in rows]


@router.post("/entries", dependencies=[Depends(_check_push_secret)])
def receive_nightscout_entries(
    entries: list[Any] = Body(...),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> dict:
    """
    Nightscout-compatible push receiver.

    Accepts a JSON array of Nightscout-format SGV entries and inserts them into
    the local SQLite database.  Intended for use with nightscout-librelink-up
    configured to push to GlucoAssist instead of a real Nightscout instance.

    Set nightscout-librelink-up's ``NIGHTSCOUT_URL`` to::

        http://<glucoassist-host>:<port>

    nightscout-librelink-up will POST to ``/api/v1/entries``, which this endpoint
    handles directly.  Set ``CGM_SOURCE=librelink_push`` to disable the polling
    scheduler so GlucoAssist does not also try to pull from a URL.
    """
    inserted = push_entries(db, [e for e in entries if isinstance(e, dict)])
    return {"status": "ok", "received": len(entries), "inserted": inserted}
