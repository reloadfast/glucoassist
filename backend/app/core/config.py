from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_env: str = "production"
    app_secret_key: str = "change-me"  # noqa: S105  # placeholder, must be overridden via env var

    # Database
    database_path: str = "/data/glucosense.db"

    # CGM source
    cgm_source: str = "librelink"
    librelink_url: str = ""
    librelink_poll_interval: int = 300
    nightscout_url: str = ""
    nightscout_token: str = ""

    # Ingest
    ingest_interval_seconds: int = 300


@lru_cache
def get_settings() -> Settings:
    return Settings()
