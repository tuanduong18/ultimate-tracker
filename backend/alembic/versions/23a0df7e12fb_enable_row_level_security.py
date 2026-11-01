"""enable row-level security on every table

Revision ID: 23a0df7e12fb
Revises: 0bff118503ff
Create Date: 2026-11-01 00:00:00.000000
"""
from collections.abc import Sequence

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '23a0df7e12fb'
down_revision: str | None = '0bff118503ff'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Every table in public that was made without it. exchange_rates and
# notifications have had it since a7c2e5f93b14. alembic_version is alembic's
# own, but it sits in public all the same.
_TABLES = (
    'profiles',
    'categories',
    'expenses',
    'budgets',
    'budget_categories',
    'subscriptions',
    'alembic_version',
)


def upgrade() -> None:
    # Supabase serves the public schema over its Data API to anyone holding
    # the anon key, which ships in the frontend. Today only missing grants keep
    # these tables out of reach; row-level security with no policy shuts them
    # whatever is granted later. The backend connects as their owner, which RLS
    # does not restrict, so nothing the app does changes.
    for table in _TABLES:
        op.execute(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY')

    # notifications has a policy letting a signed-in user SELECT their own
    # rows, for Supabase Realtime, but the role was never granted SELECT on
    # the table, and a policy only narrows what a grant allows. Realtime
    # checks the column privilege before pushing a change (realtime.apply_rls)
    # and answers "401 Unauthorized" without it, so the bell got no live
    # inserts or updates. The grant reaches only the rows the policy allows.
    # Supabase-only, like the policy.
    op.execute("""
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            GRANT SELECT ON notifications TO authenticated;
        END IF;
    END $$;
    """)


def downgrade() -> None:
    op.execute("""
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            REVOKE SELECT ON notifications FROM authenticated;
        END IF;
    END $$;
    """)
    for table in _TABLES:
        op.execute(f'ALTER TABLE {table} DISABLE ROW LEVEL SECURITY')
