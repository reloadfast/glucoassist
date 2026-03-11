import requests as http_requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.models.app_setting import AppSetting
from app.models.autoresearcher_log import AutoresearcherLog
from app.services import autoresearcher as ar_service

router = APIRouter(prefix="/autoresearcher", tags=["autoresearcher"])

_DEFAULTS = {
    "autoresearcher_ollama_url": "http://localhost:11434",
    "autoresearcher_ollama_model": "llama3.1:8b",
}


_PROGRAM_MD_KEY = "autoresearcher_program_md"


def _get_program_md(db: Session) -> tuple[str, bool]:
    """Return (content, is_custom). Falls back to bundled default."""
    row = db.get(AppSetting, _PROGRAM_MD_KEY)
    if row:
        return row.value, True
    return ar_service.get_default_program_md(), False


def _get_setting(db: Session, key: str) -> str:
    row = db.get(AppSetting, key)
    return row.value if row else _DEFAULTS.get(key, "")


class RunRequest(BaseModel):
    n_experiments: int = 10


class RunResponse(BaseModel):
    run_id: str
    message: str


@router.post("/run", status_code=202)
def start_run(body: RunRequest, db: Session = Depends(get_db)) -> RunResponse:
    """Start an ad-hoc autoresearcher run. Returns 409 if already running."""
    # Check enabled flag
    enabled_row = db.get(AppSetting, "autoresearcher_enabled")
    if enabled_row and enabled_row.value.lower() == "false":
        raise HTTPException(
            status_code=403,
            detail="Autoresearcher is disabled. Enable it in Settings first.",
        )

    ollama_url = _get_setting(db, "autoresearcher_ollama_url")
    ollama_model = _get_setting(db, "autoresearcher_ollama_model")
    program_md, _ = _get_program_md(db)

    try:
        run_id = ar_service.start_run(
            db_path=get_settings().database_path,
            n_experiments=body.n_experiments,
            ollama_url=ollama_url,
            ollama_model=ollama_model,
            program_md=program_md,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return RunResponse(run_id=run_id, message=f"Started {body.n_experiments} experiments")


@router.get("/status")
def get_status() -> dict:
    """Return current run state: idle | running | error."""
    return ar_service.get_status()


@router.delete("/run", status_code=200)
def cancel_run() -> dict:
    """Request cancellation of the running loop (stops after current experiment)."""
    stopped = ar_service.request_stop()
    if not stopped:
        raise HTTPException(status_code=404, detail="No run is currently in progress")
    return {"message": "Stop requested — will halt after current experiment completes"}


@router.get("/log")
def get_log(
    limit: int = 50,
    run_id: str | None = None,
    db: Session = Depends(get_db),
) -> list[dict]:
    """Return the last N experiment results, optionally filtered by run_id."""
    q = db.query(AutoresearcherLog).order_by(AutoresearcherLog.id.desc())
    if run_id:
        q = q.filter(AutoresearcherLog.run_id == run_id)
    rows = q.limit(limit).all()
    return [
        {
            "id": r.id,
            "run_id": r.run_id,
            "experiment_id": r.experiment_id,
            "timestamp": r.timestamp.strftime("%Y-%m-%dT%H:%M:%SZ")
            if r.timestamp
            else None,
            "description": r.description,
            "mae_30": r.mae_30,
            "mae_60": r.mae_60,
            "mae_90": r.mae_90,
            "mae_120": r.mae_120,
            "promoted": r.promoted,
            "elapsed_s": r.elapsed_s,
            "feature_config": r.feature_config,
            "model_config": r.model_config,
            "notes": r.notes,
        }
        for r in reversed(rows)
    ]


@router.get("/ollama/ping")
def ping_ollama(db: Session = Depends(get_db)) -> dict:
    """Test whether the configured Ollama server is reachable."""
    ollama_url = _get_setting(db, "autoresearcher_ollama_url")
    try:
        r = http_requests.get(f"{ollama_url}/api/version", timeout=5)
        r.raise_for_status()
        version = r.json().get("version", "unknown")
        return {"reachable": True, "version": version}
    except Exception as exc:  # noqa: BLE001 — surface all connection errors to client
        return {"reachable": False, "error": str(exc)}


@router.get("/ollama/models")
def list_ollama_models(db: Session = Depends(get_db)) -> dict:
    """Return the list of models installed on the configured Ollama server."""
    ollama_url = _get_setting(db, "autoresearcher_ollama_url")
    try:
        r = http_requests.get(f"{ollama_url}/api/tags", timeout=5)
        r.raise_for_status()
        models = [m["name"] for m in r.json().get("models", [])]
        return {"models": models}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502, detail=f"Cannot reach Ollama at {ollama_url}: {exc}"
        ) from exc


class ProgramUpdateRequest(BaseModel):
    content: str


@router.get("/program")
def get_program(db: Session = Depends(get_db)) -> dict:
    """Return the current research program. is_custom=false means the bundled default is active."""
    content, is_custom = _get_program_md(db)
    return {"content": content, "is_custom": is_custom}


@router.put("/program")
def update_program(body: ProgramUpdateRequest, db: Session = Depends(get_db)) -> dict:
    """Save a custom research program to the database."""
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=422, detail="Program content cannot be empty")
    row = db.get(AppSetting, _PROGRAM_MD_KEY)
    if row is None:
        row = AppSetting(key=_PROGRAM_MD_KEY, value=content)
        db.add(row)
    else:
        row.value = content
    db.commit()
    return {"content": content, "is_custom": True}


@router.post("/program/reset")
def reset_program(db: Session = Depends(get_db)) -> dict:
    """Delete the custom program, reverting to the bundled default."""
    row = db.get(AppSetting, _PROGRAM_MD_KEY)
    if row is not None:
        db.delete(row)
        db.commit()
    content = ar_service.get_default_program_md()
    return {"content": content, "is_custom": False}
