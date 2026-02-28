"""add food_items table and meal.food_item_ids column

Revision ID: 0006
Revises: 0005
Create Date: 2026-02-28 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "food_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("carbs_per_100g", sa.Float(), nullable=False),
        sa.Column("default_portion_g", sa.Float(), nullable=False, server_default="100"),
        sa.Column("aliases", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("use_count", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_food_items_name", "food_items", ["name"])
    op.create_index("ix_food_items_use_count", "food_items", ["use_count"])

    op.add_column("meals", sa.Column("food_item_ids", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("meals", "food_item_ids")
    op.drop_index("ix_food_items_use_count", table_name="food_items")
    op.drop_index("ix_food_items_name", table_name="food_items")
    op.drop_table("food_items")
