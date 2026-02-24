"""Add indexes on pattern_history.first_detected_at and last_detected_at

Revision ID: 0005
Revises: 0004
Create Date: 2026-02-23 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_pattern_history_last_detected_at",
        "pattern_history",
        ["last_detected_at"],
    )
    op.create_index(
        "ix_pattern_history_first_detected_at",
        "pattern_history",
        ["first_detected_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_pattern_history_first_detected_at", table_name="pattern_history")
    op.drop_index("ix_pattern_history_last_detected_at", table_name="pattern_history")
