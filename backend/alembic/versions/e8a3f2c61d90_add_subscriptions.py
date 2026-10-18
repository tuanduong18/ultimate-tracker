"""add subscriptions

Revision ID: e8a3f2c61d90
Revises: d5e1a09c4b77
Create Date: 2026-10-15 00:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8a3f2c61d90'
down_revision: str | None = 'd5e1a09c4b77'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('subscriptions',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('category_id', sa.Uuid(), nullable=True),
    sa.Column('name', sa.String(length=80), nullable=False),
    sa.Column('amount', sa.Numeric(precision=20, scale=3), nullable=False),
    sa.Column('currency', sa.String(length=3), nullable=False),
    sa.Column('interval_unit', sa.String(length=5), nullable=False),
    sa.Column('interval_count', sa.SmallInteger(), nullable=False),
    sa.Column('started_on', sa.Date(), nullable=False),
    sa.Column('trial_ends_on', sa.Date(), nullable=True),
    sa.Column('next_billing_on', sa.Date(), nullable=False),
    sa.Column('cancelled_on', sa.Date(), nullable=True),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('amount > 0', name='ck_subscriptions_amount_positive'),
    sa.CheckConstraint("interval_unit IN ('day', 'week', 'month', 'year')", name='ck_subscriptions_interval_unit'),
    sa.CheckConstraint('interval_count > 0', name='ck_subscriptions_interval_count_positive'),
    sa.CheckConstraint('trial_ends_on > started_on', name='ck_subscriptions_trial_after_start'),
    sa.CheckConstraint('next_billing_on >= COALESCE(trial_ends_on, started_on)', name='ck_subscriptions_next_billing_after_anchor'),
    sa.CheckConstraint('cancelled_on >= started_on', name='ck_subscriptions_cancel_after_start'),
    sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_subscriptions_user_id', 'subscriptions', ['user_id'], unique=False)
    op.create_index('ix_subscriptions_next_billing_on', 'subscriptions', ['next_billing_on'], unique=False)
    op.create_index('ix_subscriptions_category_id', 'subscriptions', ['category_id'], unique=False)

    # New profiles get "Subscriptions" from DEFAULT_CATEGORIES; this gives it to
    # existing ones. ON CONFLICT skips users who already made one by that name.
    op.execute(
        """
        INSERT INTO categories (id, user_id, name, colour)
        SELECT gen_random_uuid(), id, 'Subscriptions', '#f59e0b' FROM profiles
        ON CONFLICT ON CONSTRAINT uq_categories_user_name DO NOTHING
        """
    )


def downgrade() -> None:
    # The backfilled "Subscriptions" categories are left in place: by now they may
    # hold expenses, and a user-created one with the same name is indistinguishable.
    op.drop_index('ix_subscriptions_category_id', table_name='subscriptions')
    op.drop_index('ix_subscriptions_next_billing_on', table_name='subscriptions')
    op.drop_index('ix_subscriptions_user_id', table_name='subscriptions')
    op.drop_table('subscriptions')
