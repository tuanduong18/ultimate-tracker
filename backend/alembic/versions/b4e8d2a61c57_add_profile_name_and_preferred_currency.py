"""add profile name and preferred currency

Revision ID: b4e8d2a61c57
Revises: f2b7c4d18a35
Create Date: 2026-10-20 00:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b4e8d2a61c57'
down_revision: str | None = 'f2b7c4d18a35'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Additive and safe ahead of the code: the old code never names either column.
    op.add_column('profiles', sa.Column('display_name', sa.String(length=80), nullable=True))
    op.add_column(
        'profiles',
        sa.Column('preferred_currency', sa.String(length=3), nullable=False, server_default='USD'),
    )
    # Until now the forms defaulted to the display currency, so starting each
    # existing profile there changes nothing anyone sees.
    op.execute('UPDATE profiles SET preferred_currency = display_currency')


def downgrade() -> None:
    op.drop_column('profiles', 'preferred_currency')
    op.drop_column('profiles', 'display_name')
