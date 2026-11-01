"""add all-spending budgets, and list positions for budgets and categories

Revision ID: 0bff118503ff
Revises: 9d4c6e2b8a51
Create Date: 2026-10-31 00:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0bff118503ff'
down_revision: str | None = '9d4c6e2b8a51'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# The lists the user can arrange.
_ARRANGEABLE = ('categories', 'budgets')


def upgrade() -> None:
    # Both additive and safe ahead of the code.
    #
    # all_spending: the code deployed today never reads the column, and every
    # existing budget covers chosen categories, which is what the default says.
    op.add_column(
        'budgets',
        sa.Column('all_spending', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    # position: nothing deployed today reads it, and null is what "never
    # arranged" means, so no backfill — every list keeps its old order until
    # its owner arranges it.
    for table in _ARRANGEABLE:
        op.add_column(table, sa.Column('position', sa.Integer(), nullable=True))


def downgrade() -> None:
    # Dropping position loses only the arrangement; each list falls back to its
    # default order.
    for table in _ARRANGEABLE:
        op.drop_column(table, 'position')
    # An all-spending budget is left with no categories, which the code before
    # this reads as covering nothing (0 spent) until it is edited. Kept rather
    # than deleted: a rollback should not cost anyone their budgets.
    op.drop_column('budgets', 'all_spending')
