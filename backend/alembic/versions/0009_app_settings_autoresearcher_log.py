"""add app_settings and autoresearcher_log tables

Revision ID: 0009
Revises: 0008
Create Date: 2026-03-11 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("value", sa.String(2000), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "autoresearcher_log",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("run_id", sa.String(36), nullable=False),
        sa.Column("experiment_id", sa.Integer, nullable=False),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("mae_30", sa.Float, nullable=True),
        sa.Column("mae_60", sa.Float, nullable=True),
        sa.Column("mae_90", sa.Float, nullable=True),
        sa.Column("mae_120", sa.Float, nullable=True),
        sa.Column("promoted", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("elapsed_s", sa.Float, nullable=True),
        sa.Column("feature_config", sa.Text, nullable=True),
        sa.Column("model_config", sa.Text, nullable=True),
        sa.Column("notes", sa.String(500), nullable=True),
    )
    op.create_index(
        "ix_autoresearcher_log_run_id", "autoresearcher_log", ["run_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_autoresearcher_log_run_id", table_name="autoresearcher_log")
    op.drop_table("autoresearcher_log")
    op.drop_table("app_settings")
