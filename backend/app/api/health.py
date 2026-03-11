import os
import tomllib
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import get_settings

router = APIRouter()

_PYPROJECT = Path(__file__).parent.parent.parent / "pyproject.toml"


def _read_version() -> str:
    # Docker build injects APP_VERSION=<7-char SHA>; read it first
    env_ver = os.getenv("APP_VERSION", "").strip()
    if env_ver and env_ver != "dev":
        return env_ver
    try:
        with _PYPROJECT.open("rb") as f:
            return tomllib.load(f)["project"]["version"]
    except Exception:
        return "dev"


VERSION = _read_version()


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        version=VERSION,
        environment=settings.app_env,
    )
