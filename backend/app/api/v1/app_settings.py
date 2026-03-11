from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.app_setting import AppSetting

router = APIRouter(prefix="/app-settings", tags=["app-settings"])

# Defaults pre-seeded on first GET if not yet in the DB
_DEFAULTS: dict[str, str] = {
    "autoresearcher_enabled": "false",
    "autoresearcher_ollama_url": "http://localhost:11434",
    "autoresearcher_ollama_model": "llama3.1:8b",
}


def _seed_defaults(db: Session) -> None:
    """Insert any missing default keys (idempotent)."""
    for key, value in _DEFAULTS.items():
        if db.get(AppSetting, key) is None:
            db.add(AppSetting(key=key, value=value))
    db.commit()


@router.get("")
def get_all_settings(db: Session = Depends(get_db)) -> dict[str, str]:
    """Return all settings as a flat key→value dict, seeding defaults first."""
    _seed_defaults(db)
    rows = db.query(AppSetting).all()
    return {row.key: row.value for row in rows}


@router.put("/{key}")
def upsert_setting(
    key: str, body: dict, db: Session = Depends(get_db)
) -> dict[str, str]:
    """Upsert a single setting. Body must be ``{"value": "<string>"}``.

    Returns the updated key/value pair.
    """
    if "value" not in body:
        raise HTTPException(status_code=422, detail="Body must contain 'value' field")
    value = str(body["value"])
    row = db.get(AppSetting, key)
    if row is None:
        row = AppSetting(key=key, value=value)
        db.add(row)
    else:
        row.value = value
    db.commit()
    db.refresh(row)
    return {"key": row.key, "value": row.value}
