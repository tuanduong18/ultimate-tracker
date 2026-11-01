"""Every table in the public schema has row-level security on.

Supabase serves the public schema over its Data API to anyone holding the anon
key, which ships in the frontend. The backend connects as the tables' owner,
which RLS does not restrict, so having it on costs the app nothing and leaves
the browser's roles with no rows unless a policy says otherwise.

Checked on the schema the migrations build, so a migration that creates a
table without it fails here rather than reaching production open.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker


async def test_every_public_table_has_row_level_security(
    db_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with db_factory() as session:
        without = (
            await session.scalars(
                text(
                    """
                    SELECT c.relname
                    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = 'public'
                      AND c.relkind IN ('r', 'p')
                      AND NOT c.relrowsecurity
                    ORDER BY c.relname
                    """
                )
            )
        ).all()

    assert without == [], (
        f"Row-level security is off on: {', '.join(without)}. Add "
        "ALTER TABLE <name> ENABLE ROW LEVEL SECURITY to the migration that creates it."
    )
