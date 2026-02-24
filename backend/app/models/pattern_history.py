from datetime import datetime

from sqlalchemy import DateTime, Float, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PatternHistory(Base):
    __tablename__ = "pattern_history"
    __table_args__ = (
        Index("ix_pattern_history_last_detected_at", "last_detected_at"),
        Index("ix_pattern_history_first_detected_at", "first_detected_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pattern_name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    first_detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    detection_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    last_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
