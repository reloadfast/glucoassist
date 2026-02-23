"""Additional indexes on glucose_readings for query performance

Revision ID: 0003
Revises: 0002
Create Date: 2026-02-23 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index("ix_glucose_readings_source", "glucose_readings", ["source"])
    op.create_index("ix_glucose_readings_device_id", "glucose_readings", ["device_id"])


def downgrade() -> None:
    op.drop_index("ix_glucose_readings_device_id", table_name="glucose_readings")
    op.drop_index("ix_glucose_readings_source", table_name="glucose_readings")
