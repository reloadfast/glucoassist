"""Phase 5: retrain_log and pattern_history tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-02-23 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "retrain_log",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("trigger_source", sa.String(length=20), nullable=False),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("training_samples", sa.Integer(), nullable=True),
        sa.Column("mae_h30", sa.Float(), nullable=True),
        sa.Column("mae_h60", sa.Float(), nullable=True),
        sa.Column("mae_h120", sa.Float(), nullable=True),
        sa.Column("promoted", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_retrain_log_triggered_at", "retrain_log", ["triggered_at"])

    op.create_table(
        "pattern_history",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("pattern_name", sa.String(length=100), nullable=False),
        sa.Column("first_detected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_detected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("detection_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("last_confidence", sa.Float(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("pattern_name"),
    )


def downgrade() -> None:
    op.drop_table("pattern_history")
    op.drop_index("ix_retrain_log_triggered_at", table_name="retrain_log")
    op.drop_table("retrain_log")
