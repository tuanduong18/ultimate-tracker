"""add exchange rates and notifications

Revision ID: a7c2e5f93b14
Revises: b4e8d2a61c57
Create Date: 2026-10-20 00:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7c2e5f93b14'
down_revision: str | None = 'b4e8d2a61c57'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Both tables are new and nothing deployed reads them, so this is safe to
    # apply ahead of the code. The rates table starts empty until the refresh
    # job's first run; until then reads use the hardcoded fallback rates, and
    # only those currencies can be picked for new entries.
    op.create_table('exchange_rates',
    sa.Column('currency', sa.String(length=3), nullable=False),
    sa.Column('rate_per_usd', sa.Numeric(precision=18, scale=6), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('delisted_at', sa.DateTime(timezone=True), nullable=True),
    sa.CheckConstraint('rate_per_usd > 0', name='ck_exchange_rates_positive'),
    sa.PrimaryKeyConstraint('currency')
    )

    op.create_table('notifications',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('kind', sa.String(length=32), nullable=False),
    sa.Column('title', sa.String(length=160), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('due_on', sa.Date(), nullable=True),
    sa.Column('dedupe_key', sa.String(length=120), nullable=False),
    sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('snoozed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('alerted_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("kind IN ('subscription_renewal', 'trial_ending', 'subscription_renewed', 'currency_delisted')", name='ck_notifications_kind'),
    sa.ForeignKeyConstraint(['user_id'], ['profiles.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'dedupe_key', name='uq_notifications_user_dedupe_key')
    )
    op.create_index('ix_notifications_user_alerted_at', 'notifications', ['user_id', 'alerted_at'], unique=False)

    # Row-level security on both tables. The backend connects as their owner,
    # which RLS does not restrict; what it shuts is Supabase's Data API, where
    # the public anon key could otherwise read and write them.
    #
    # notifications then gets exactly one way in from outside: a signed-in user
    # may SELECT their own rows. That is what Supabase Realtime checks before
    # pushing a change to the browser, so the bell updates live without anyone
    # seeing anyone else's notifications.
    #
    # The Supabase-only parts are guarded, so the same migration runs on the
    # plain Postgres that CI and local checks use.
    op.execute("ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE notifications ENABLE ROW LEVEL SECURITY")
    op.execute("""
    DO $$
    BEGIN
        IF to_regprocedure('auth.uid()') IS NOT NULL
           AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            CREATE POLICY notifications_select_own ON notifications
                FOR SELECT TO authenticated USING (user_id = auth.uid());
        END IF;
        IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
        END IF;
    END $$;
    """)


def downgrade() -> None:
    # Dropping the table also drops its index and policy and takes it out of
    # the Realtime publication — whichever shape of this table was applied.
    op.drop_table('notifications')
    op.drop_table('exchange_rates')
