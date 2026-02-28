from datetime import date, datetime

from sqlalchemy import Date, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class GarminIngestLog(Base):
    __tablename__ = "garmin_ingest_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    target_date: Mapped[date] = mapped_column(Date, nullable=False)
    # success | partial | empty | skipped | auth_error | rate_limited | connection_error | error
    outcome: Mapped[str] = mapped_column(String(20), nullable=False)
    fields_populated: Mapped[str | None] = mapped_column(String(100), nullable=True)
    error_detail: Mapped[str | None] = mapped_column(String(500), nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
