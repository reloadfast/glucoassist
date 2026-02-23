import subprocess
from pathlib import Path

from sqlalchemy import create_engine, event

import app.models  # noqa: F401 — side-effect import to register all models
from app.core.config import get_settings
from app.db.base import Base  # noqa: F401 — ensures models are registered


def _get_engine():
    settings = get_settings()
    db_url = f"sqlite:///{settings.database_path}"
    engine = create_engine(db_url, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def set_wal_mode(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

    return engine


engine = _get_engine()


def init_db() -> None:
    """Create tables if not exists and run alembic migrations."""
    settings = get_settings()
    db_path = Path(settings.database_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    # Run alembic upgrade head from backend directory
    backend_dir = Path(__file__).parent.parent.parent
    subprocess.run(  # noqa: S603
        ["alembic", "upgrade", "head"],  # noqa: S607
        cwd=backend_dir,
        check=True,
        capture_output=True,
    )
