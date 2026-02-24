from typing import Any

from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.ingest import push_entries

router = APIRouter(tags=["ingest"])


@router.post("/entries")
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
