from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.core.config import get_settings
from app.core.logger import setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    settings = get_settings()
    setup_logging(settings.app_env)

    from app.db.engine import init_db
    from app.services.scheduler import start_scheduler, stop_scheduler

    init_db()
    start_scheduler(settings)
    yield
    stop_scheduler()


def create_app() -> FastAPI:
    settings = get_settings()

    application = FastAPI(
        title="GlucoSense",
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS
    if settings.app_env == "development":
        allow_origins = ["*"]
    else:
        allow_origins = []  # restrict to same-origin in production (behind Nginx)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(health_router, prefix="/api")

    from app.api import router as api_router
    application.include_router(api_router)

    return application


app = create_app()
