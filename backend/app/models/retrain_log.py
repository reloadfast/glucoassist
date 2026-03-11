from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RetrainLog(Base):
    __tablename__ = "retrain_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    triggered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    trigger_source: Mapped[str] = mapped_column(String(20), nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    training_samples: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mae_h30: Mapped[float | None] = mapped_column(Float, nullable=True)
    mae_h60: Mapped[float | None] = mapped_column(Float, nullable=True)
    mae_h90: Mapped[float | None] = mapped_column(Float, nullable=True)
    mae_h120: Mapped[float | None] = mapped_column(Float, nullable=True)
    promoted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (Index("ix_retrain_log_triggered_at", "triggered_at"),)
