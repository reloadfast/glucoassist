from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_env: str = "production"
    app_secret_key: str = "change-me"  # noqa: S105  # placeholder, must be overridden via env var

    # Database
    database_path: str = "/data/glucoassist.db"

    # CGM source
    cgm_source: str = "librelink"
    librelink_url: str = ""
    librelink_poll_interval: int = 300
    nightscout_url: str = ""
    nightscout_token: str = ""

    # Push receiver auth — optional; when set, /api/v1/entries requires a
    # matching API-SECRET header (same value as the uploader's nightscout token)
    push_secret: str = ""

    # Ingest
    ingest_interval_seconds: int = 300

    # Historical backfill: days of history to import on first startup (0 = disabled)
    backfill_days: int = 90

    # Forecasting: how often to retrain models (hours)
    retrain_interval_hours: int = 24

    # Garmin integration
    garmin_enabled: bool = False
    garmin_username: str = ""
    garmin_password: str = ""
    garmin_ingest_interval_seconds: int = 3600
    garmin_tokenstore: str = "/data/garmin_tokens"  # directory for cached OAuth tokens

    # Direct LibreLink integration (cgm_source = "librelink_direct")
    librelink_email: str = ""
    librelink_password: str = ""
    librelink_region: str = "EU"
    librelink_tokenstore: str = "/data/librelink_tokens.json"  # cached auth token (JSON file)


@lru_cache
def get_settings() -> Settings:
    return Settings()
