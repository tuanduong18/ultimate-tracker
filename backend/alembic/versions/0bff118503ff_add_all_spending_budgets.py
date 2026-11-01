"""add all-spending budgets

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


def upgrade() -> None:
    # Additive and safe ahead of the code: the code deployed today never reads
    # the column, and every existing budget covers chosen categories, which is
    # what the default says.
    op.add_column(
        'budgets',
        sa.Column('all_spending', sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    # An all-spending budget is left with no categories, which the code before
    # this reads as covering nothing (0 spent) until it is edited. Kept rather
    # than deleted: a rollback should not cost anyone their budgets.
    op.drop_column('budgets', 'all_spending')
