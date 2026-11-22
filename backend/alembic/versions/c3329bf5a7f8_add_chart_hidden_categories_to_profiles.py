"""add chart hidden categories to profiles

Revision ID: c3329bf5a7f8
Revises: 59463573285a
Create Date: 2026-11-22 09:30:00.000000

Additive and safe to apply before the code ships: the server default fills
every existing row with an empty list (no category hidden, which is how the
charts open today), and the code deployed now never reads the column.
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3329bf5a7f8'
down_revision: str | None = '59463573285a'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('profiles', sa.Column('chart_hidden_categories', sa.ARRAY(sa.Uuid()), server_default=sa.text("'{}'"), nullable=False))


def downgrade() -> None:
    op.drop_column('profiles', 'chart_hidden_categories')
