"""add budget period

Revision ID: f2b7c4d18a35
Revises: e8a3f2c61d90
Create Date: 2026-10-18 00:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2b7c4d18a35'
down_revision: str | None = 'e8a3f2c61d90'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Additive and backward-compatible with the code deployed today: every
    # existing row becomes 'custom', which is exactly what it already was, and
    # relaxing ends_on to nullable changes nothing until new code writes a null.
    op.add_column(
        'budgets',
        sa.Column('period', sa.String(length=7), nullable=False, server_default='custom'),
    )
    op.alter_column('budgets', 'ends_on', existing_type=sa.Date(), nullable=True)
    op.create_check_constraint(
        'ck_budgets_period', 'budgets', "period IN ('custom', 'monthly')"
    )
    op.create_check_constraint(
        'ck_budgets_custom_has_end', 'budgets', "period = 'monthly' OR ends_on IS NOT NULL"
    )


def downgrade() -> None:
    # Lossy by necessity: an open-ended monthly budget has no end date to fall
    # back to. Each one is closed at the end of its first month, so the old
    # NOT NULL holds and the row survives as a one-month fixed-range budget.
    op.execute(
        """
        UPDATE budgets
        SET ends_on = (date_trunc('month', starts_on) + interval '1 month - 1 day')::date
        WHERE ends_on IS NULL
        """
    )
    op.drop_constraint('ck_budgets_custom_has_end', 'budgets', type_='check')
    op.drop_constraint('ck_budgets_period', 'budgets', type_='check')
    op.alter_column('budgets', 'ends_on', existing_type=sa.Date(), nullable=False)
    op.drop_column('budgets', 'period')
