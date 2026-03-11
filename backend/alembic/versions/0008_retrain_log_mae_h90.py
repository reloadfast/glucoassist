"""add mae_h90 to retrain_log

Revision ID: 0008
Revises: 0007
Create Date: 2026-03-11 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("retrain_log", sa.Column("mae_h90", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("retrain_log", "mae_h90")
