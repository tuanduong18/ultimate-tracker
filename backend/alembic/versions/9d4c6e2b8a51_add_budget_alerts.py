"""add budget alerts

Revision ID: 9d4c6e2b8a51
Revises: a7c2e5f93b14
Create Date: 2026-10-24 00:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9d4c6e2b8a51'
down_revision: str | None = 'a7c2e5f93b14'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_KINDS_BEFORE = (
    "'subscription_renewal', 'trial_ending', 'subscription_renewed', 'currency_delisted'"
)
_KINDS_AFTER = _KINDS_BEFORE + ", 'budget_warning', 'budget_exceeded'"


def upgrade() -> None:
    # Additive and safe ahead of the code: the code deployed today neither
    # reads the new column nor writes the new kinds. Existing budgets take the
    # default warning at 80%, the same as a budget made after this ships.
    op.add_column(
        'budgets',
        sa.Column('warn_at_percent', sa.SmallInteger(), nullable=True, server_default='80'),
    )
    op.create_check_constraint(
        'ck_budgets_warn_at_percent_range', 'budgets', 'warn_at_percent BETWEEN 1 AND 99'
    )
    op.drop_constraint('ck_notifications_kind', 'notifications', type_='check')
    op.create_check_constraint('ck_notifications_kind', 'notifications', f'kind IN ({_KINDS_AFTER})')


def downgrade() -> None:
    # Budget alerts cannot satisfy the old kind constraint, so they go first.
    op.execute("DELETE FROM notifications WHERE kind IN ('budget_warning', 'budget_exceeded')")
    op.drop_constraint('ck_notifications_kind', 'notifications', type_='check')
    op.create_check_constraint(
        'ck_notifications_kind', 'notifications', f'kind IN ({_KINDS_BEFORE})'
    )
    op.drop_constraint('ck_budgets_warn_at_percent_range', 'budgets', type_='check')
    op.drop_column('budgets', 'warn_at_percent')
