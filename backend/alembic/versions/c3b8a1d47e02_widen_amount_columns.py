"""widen amount columns to numeric(20, 3)

Revision ID: c3b8a1d47e02
Revises: 4f91106140be
Create Date: 2026-08-19 00:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3b8a1d47e02'
down_revision: str | None = '4f91106140be'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Scale 2 could not hold the third minor unit of KWD, BHD, JOD, OMR, LYD and
    # TND, and precision 12 was tight for zero-decimal currencies like VND.
    # Widening is lossless, so existing rows carry over untouched.
    op.alter_column(
        'expenses',
        'amount',
        existing_type=sa.Numeric(precision=12, scale=2),
        type_=sa.Numeric(precision=20, scale=3),
        existing_nullable=False,
    )
    op.alter_column(
        'budgets',
        'amount',
        existing_type=sa.Numeric(precision=12, scale=2),
        type_=sa.Numeric(precision=20, scale=3),
        existing_nullable=False,
    )


def downgrade() -> None:
    # Narrowing back rounds away any third decimal place a 3-minor-unit currency
    # recorded. Nothing else can be done: the precision is simply not there.
    op.alter_column(
        'budgets',
        'amount',
        existing_type=sa.Numeric(precision=20, scale=3),
        type_=sa.Numeric(precision=12, scale=2),
        existing_nullable=False,
    )
    op.alter_column(
        'expenses',
        'amount',
        existing_type=sa.Numeric(precision=20, scale=3),
        type_=sa.Numeric(precision=12, scale=2),
        existing_nullable=False,
    )
