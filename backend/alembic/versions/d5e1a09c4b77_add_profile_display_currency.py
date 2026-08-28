"""add profile display currency

Revision ID: d5e1a09c4b77
Revises: c3b8a1d47e02
Create Date: 2026-08-25 00:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5e1a09c4b77'
down_revision: str | None = 'c3b8a1d47e02'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # server_default, not just a Python-side default: the column is NOT NULL and
    # existing rows need a value at the moment the column appears. It also keeps
    # the currently deployed code — which does not know this column exists —
    # able to insert profiles between this migration and the next deploy.
    op.add_column(
        'profiles',
        sa.Column(
            'display_currency',
            sa.String(length=3),
            nullable=False,
            server_default='USD',
        ),
    )


def downgrade() -> None:
    op.drop_column('profiles', 'display_currency')
