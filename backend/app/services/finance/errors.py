"""Finance domain failures.

Each carries the HTTP status and stable error code the API answers with, so the
route layer's translation is a single line and every handler agrees on the
mapping.
"""


class FinanceError(Exception):
    """Base for finance domain failures; subclasses pin the HTTP mapping."""

    status_code = 400
    code = "FINANCE_ERROR"


class NotFoundError(FinanceError):
    status_code = 404
    code = "NOT_FOUND"

    def __init__(self, resource: str) -> None:
        super().__init__(f"{resource} not found.")


class CategoryNameTakenError(FinanceError):
    status_code = 409
    code = "CATEGORY_NAME_TAKEN"

    def __init__(self, name: str) -> None:
        super().__init__(f"A category named {name!r} already exists.")


class UnknownCategoryError(FinanceError):
    status_code = 422
    code = "UNKNOWN_CATEGORY"

    def __init__(self) -> None:
        super().__init__("One or more category ids do not exist for this user.")


class InvalidAmountError(FinanceError):
    status_code = 422
    code = "INVALID_AMOUNT"


class UnsupportedCurrencyError(FinanceError):
    status_code = 422
    code = "UNSUPPORTED_CURRENCY"


class InvalidDateRangeError(FinanceError):
    status_code = 422
    code = "INVALID_DATE_RANGE"

    def __init__(self, message: str = "ends_on must be on or after starts_on.") -> None:
        super().__init__(message)


class SubscriptionCancelledError(FinanceError):
    """Renewing a subscription whose next charge a cancellation has stopped."""

    status_code = 409
    code = "SUBSCRIPTION_CANCELLED"

    def __init__(self) -> None:
        super().__init__("This subscription is cancelled before its next charge; resume it first.")


class RateUnavailableError(FinanceError):
    status_code = 503
    code = "RATE_UNAVAILABLE"

    def __init__(self, detail: str) -> None:
        super().__init__(f"Could not convert to the display currency: {detail}")


class ImportFileError(FinanceError):
    """An upload that can't be read as a whole: not a spreadsheet, no column
    names, too many rows. A problem with one row is reported, not raised.

    The message is written for the person who chose the file."""

    status_code = 422
    code = "IMPORT_FILE_REJECTED"


class UnknownGranularityError(FinanceError):
    status_code = 422
    code = "UNKNOWN_GRANULARITY"

    def __init__(self, granularity: str) -> None:
        super().__init__(f"granularity must be 'day' or 'week', got {granularity!r}.")
