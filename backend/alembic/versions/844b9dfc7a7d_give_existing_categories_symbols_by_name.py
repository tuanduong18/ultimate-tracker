"""give existing categories symbols by name

Revision ID: 844b9dfc7a7d
Revises: cecd4e4f75b9
Create Date: 2026-11-07 21:17:17.174031
"""
from collections.abc import Sequence

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '844b9dfc7a7d'
down_revision: str | None = 'cecd4e4f75b9'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Gives a symbol to each category made before symbols existed whose name is
    # a symbol's name, so an existing user's Food or Groceries looks like a new
    # user's.
    #
    # - Only where no symbol is set (icon IS NULL): by the time this runs,
    #   someone may already have picked one in the web's picker, and a migration
    #   must never overwrite a person's choice.
    # - The name must equal one of the 30 symbols' names, in any case ("FOOD",
    #   "food"); the API stores names trimmed. The one other match is Rent, which
    #   the starter set draws as home. Nothing is guessed from a near match
    #   ("Food & drinks", "Gym"): a migration writes without anyone seeing it, so
    #   it does only what is certain, and leaves the rest to the picker.
    # - The keys are written out here rather than read from the apps' lists: a
    #   migration is a snapshot, and must keep doing what it did today even if
    #   the lists change later. Each is on the shared list in
    #   docs/features/finance.md § Category symbols, where a symbol's key is its
    #   name in lower case — which is why ELSE can store lower(name) as it is.
    op.execute(
        """
        UPDATE categories
        SET icon = CASE lower(name) WHEN 'rent' THEN 'home' ELSE lower(name) END
        WHERE icon IS NULL
          AND lower(name) IN (
            'food', 'groceries', 'coffee', 'home', 'bills', 'utilities', 'phone',
            'internet', 'transport', 'car', 'fuel', 'travel', 'health', 'fitness',
            'education', 'books', 'entertainment', 'games', 'music', 'subscriptions',
            'shopping', 'clothes', 'gifts', 'pets', 'kids', 'beauty', 'insurance',
            'savings', 'work', 'other',
            'rent'
          )
        """
    )


def downgrade() -> None:
    # Nothing to undo safely: once someone has used the picker, a backfilled
    # symbol can't be told apart from one they chose, and clearing both would
    # throw their choice away. The symbols are only data in a column the
    # previous migration's downgrade drops anyway.
    pass
