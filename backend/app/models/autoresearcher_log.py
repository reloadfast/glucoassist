from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AutoresearcherLog(Base):
    __tablename__ = "autoresearcher_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(String(36), nullable=False)
    experiment_id: Mapped[int] = mapped_column(Integer, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    mae_30: Mapped[float | None] = mapped_column(Float, nullable=True)
    mae_60: Mapped[float | None] = mapped_column(Float, nullable=True)
    mae_90: Mapped[float | None] = mapped_column(Float, nullable=True)
    mae_120: Mapped[float | None] = mapped_column(Float, nullable=True)
    promoted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    elapsed_s: Mapped[float | None] = mapped_column(Float, nullable=True)
    feature_config: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_config: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    __table_args__ = (Index("ix_autoresearcher_log_run_id", "run_id"),)
