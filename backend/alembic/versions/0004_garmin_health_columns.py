"""Add sleep_hours, stress_level, source to health_metrics (Garmin integration)

Revision ID: 0004
Revises: 0003
Create Date: 2026-02-23 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("health_metrics", sa.Column("sleep_hours", sa.Float(), nullable=True))
    op.add_column("health_metrics", sa.Column("stress_level", sa.Integer(), nullable=True))
    op.add_column("health_metrics", sa.Column("source", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("health_metrics", "source")
    op.drop_column("health_metrics", "stress_level")
    op.drop_column("health_metrics", "sleep_hours")
