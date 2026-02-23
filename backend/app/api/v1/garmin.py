from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings

router = APIRouter(tags=["garmin"])


@router.get("/garmin/status")
def garmin_status(settings: Settings = Depends(get_settings)) -> dict:
    return {
        "enabled": settings.garmin_enabled,
        "username_configured": bool(settings.garmin_username),
        "interval_seconds": max(settings.garmin_ingest_interval_seconds, 3600),
    }
