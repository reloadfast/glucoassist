"""add garmin_ingest_log table

Revision ID: 0007
Revises: 0006
Create Date: 2026-02-28 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "garmin_ingest_log",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("run_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("target_date", sa.Date, nullable=False),
        sa.Column("outcome", sa.String(20), nullable=False),
        sa.Column("fields_populated", sa.String(100), nullable=True),
        sa.Column("error_detail", sa.String(500), nullable=True),
        sa.Column("retry_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_garmin_ingest_log_run_at", "garmin_ingest_log", ["run_at"])


def downgrade() -> None:
    op.drop_index("ix_garmin_ingest_log_run_at", table_name="garmin_ingest_log")
    op.drop_table("garmin_ingest_log")
