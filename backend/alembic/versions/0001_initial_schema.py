"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-02-23 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "glucose_readings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("glucose_mg_dl", sa.Integer(), nullable=False),
        sa.Column("trend_arrow", sa.String(length=10), nullable=True),
        sa.Column("source", sa.String(length=50), nullable=False),
        sa.Column("device_id", sa.String(length=100), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("timestamp"),
    )
    op.create_index("ix_glucose_readings_timestamp", "glucose_readings", ["timestamp"])

    op.create_table(
        "insulin_doses",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("units", sa.Float(), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_insulin_doses_timestamp", "insulin_doses", ["timestamp"])

    op.create_table(
        "meals",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("carbs_g", sa.Float(), nullable=False),
        sa.Column("label", sa.String(length=200), nullable=True),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_meals_timestamp", "meals", ["timestamp"])

    op.create_table(
        "health_metrics",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("heart_rate_bpm", sa.Integer(), nullable=True),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("activity_type", sa.String(length=100), nullable=True),
        sa.Column("activity_minutes", sa.Integer(), nullable=True),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_health_metrics_timestamp", "health_metrics", ["timestamp"])


def downgrade() -> None:
    op.drop_index("ix_health_metrics_timestamp", table_name="health_metrics")
    op.drop_table("health_metrics")
    op.drop_index("ix_meals_timestamp", table_name="meals")
    op.drop_table("meals")
    op.drop_index("ix_insulin_doses_timestamp", table_name="insulin_doses")
    op.drop_table("insulin_doses")
    op.drop_index("ix_glucose_readings_timestamp", table_name="glucose_readings")
    op.drop_table("glucose_readings")
