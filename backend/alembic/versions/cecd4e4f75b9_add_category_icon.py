"""add category icon

Revision ID: cecd4e4f75b9
Revises: 23a0df7e12fb
Create Date: 2026-11-06 15:52:45.776563
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cecd4e4f75b9'
down_revision: str | None = '23a0df7e12fb'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Additive and backward-compatible with the code deployed today: a nullable
    # column with no default, which existing rows take as null ("no symbol") and
    # today's code never reads. Safe to apply before the code that uses it ships.
    op.add_column(
        'categories',
        sa.Column('icon', sa.String(length=32), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('categories', 'icon')
