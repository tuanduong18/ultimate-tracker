"""Finance domain business logic: categories, expenses, budgets, subscriptions
and summaries.

Split by resource, one module each. Everything callers use is re-exported here,
so ``from app.services import finance as finance_service`` stays the one import.

Failures are raised as FinanceError subclasses (see ``errors``).
"""

from app.services.finance.billing import billing_date, next_billing_date
from app.services.finance.budgets import (
    create_budget,
    delete_budget,
    list_budgets,
    update_budget,
)
from app.services.finance.categories import (
    DEFAULT_CATEGORIES,
    build_default_categories,
    create_category,
    delete_category,
    list_categories,
    update_category,
)
from app.services.finance.errors import (
    CategoryNameTakenError,
    FinanceError,
    ImportFileError,
    InvalidAmountError,
    InvalidDateRangeError,
    NotFoundError,
    RateUnavailableError,
    UnknownCategoryError,
    UnknownGranularityError,
    UnsupportedCurrencyError,
)
from app.services.finance.expenses import (
    create_expense,
    delete_expense,
    list_expenses,
    list_expenses_by_id,
    update_expense,
)
from app.services.finance.export import XLSX_MEDIA_TYPE, export_expenses
from app.services.finance.imports import (
    MAX_IMPORT_BYTES,
    MAX_IMPORT_ROWS,
    import_expenses,
    import_template,
    preview_import,
)
from app.services.finance.subscriptions import (
    create_subscription,
    delete_subscription,
    list_subscriptions,
    update_subscription,
)
from app.services.finance.summaries import (
    BUCKETERS,
    UNCATEGORIZED_COLOUR,
    UNCATEGORIZED_NAME,
    budget_progress,
    category_clause,
    day_buckets,
    summarize,
    summarize_by_category,
    summarize_by_period,
    week_buckets,
)

__all__ = [
    "BUCKETERS",
    "DEFAULT_CATEGORIES",
    "MAX_IMPORT_BYTES",
    "MAX_IMPORT_ROWS",
    "XLSX_MEDIA_TYPE",
    "UNCATEGORIZED_COLOUR",
    "UNCATEGORIZED_NAME",
    "CategoryNameTakenError",
    "FinanceError",
    "ImportFileError",
    "InvalidAmountError",
    "InvalidDateRangeError",
    "NotFoundError",
    "RateUnavailableError",
    "UnknownCategoryError",
    "UnknownGranularityError",
    "UnsupportedCurrencyError",
    "billing_date",
    "budget_progress",
    "build_default_categories",
    "category_clause",
    "create_budget",
    "create_category",
    "create_expense",
    "create_subscription",
    "day_buckets",
    "delete_budget",
    "delete_category",
    "delete_expense",
    "delete_subscription",
    "export_expenses",
    "import_expenses",
    "import_template",
    "list_budgets",
    "list_categories",
    "list_expenses",
    "list_expenses_by_id",
    "list_subscriptions",
    "next_billing_date",
    "preview_import",
    "summarize",
    "summarize_by_category",
    "summarize_by_period",
    "update_budget",
    "update_category",
    "update_expense",
    "update_subscription",
    "week_buckets",
]
