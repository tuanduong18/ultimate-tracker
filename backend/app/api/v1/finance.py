"""finance API routes (v1). Keep handlers thin — business logic lives in app/services/."""

import uuid
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import timezones
from app.core.security import get_current_user_id
from app.db.session import get_db
from app.schemas.finance import (
    BudgetCreate,
    BudgetProgressRead,
    BudgetRead,
    BudgetUpdate,
    CategoryBreakdownRead,
    CategoryCreate,
    CategoryRead,
    CategoryUpdate,
    ExpenseCreate,
    ExpenseExportRequest,
    ExpenseImportPreviewRead,
    ExpenseImportResultRead,
    ExpenseRead,
    ExpenseUpdate,
    Granularity,
    PeriodBreakdownRead,
    SubscriptionCreate,
    SubscriptionRead,
    SubscriptionUpdate,
    SummaryRead,
)
from app.services import exchange_rates
from app.services import finance as finance_service
from app.services import profile as profile_service

router = APIRouter()


def _as_http(exc: finance_service.FinanceError) -> HTTPException:
    """Translate a domain error into the standard error envelope."""
    return HTTPException(
        status_code=exc.status_code, detail={"code": exc.code, "message": str(exc)}
    )


def _today_in(timezone: str) -> date:
    """The current date where the user is, which is what billing dates mean."""
    return timezones.today_in(timezone)


# --- Categories ---------------------------------------------------------------


@router.get("/categories", response_model=list[CategoryRead])
async def list_categories(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[CategoryRead]:
    categories = await finance_service.list_categories(db, user_id)
    return [CategoryRead.model_validate(c) for c in categories]


@router.post("/categories", response_model=CategoryRead, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> CategoryRead:
    try:
        category = await finance_service.create_category(db, user_id, payload)
    except finance_service.FinanceError as exc:
        raise _as_http(exc) from exc
    return CategoryRead.model_validate(category)


@router.patch("/categories/{category_id}", response_model=CategoryRead)
async def update_category(
    category_id: uuid.UUID,
    payload: CategoryUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> CategoryRead:
    try:
        category = await finance_service.update_category(db, user_id, category_id, payload)
    except finance_service.FinanceError as exc:
        raise _as_http(exc) from exc
    return CategoryRead.model_validate(category)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    try:
        await finance_service.delete_category(db, user_id, category_id)
    except finance_service.FinanceError as exc:
        raise _as_http(exc) from exc


# --- Expenses -----------------------------------------------------------------


@router.get("/expenses", response_model=list[ExpenseRead])
async def list_expenses(
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[ExpenseRead]:
    expenses = await finance_service.list_expenses(
        db, user_id, start_date=start_date, end_date=end_date, limit=limit, offset=offset
    )
    return [ExpenseRead.model_validate(e) for e in expenses]


@router.post(
    "/expenses/export",
    response_class=Response,
    responses={200: {"content": {finance_service.XLSX_MEDIA_TYPE: {}}}},
)
async def export_expenses(
    payload: ExpenseExportRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """The listed expenses as an .xlsx file, newest first.

    A POST because the body can carry thousands of ids, more than a URL holds;
    it changes nothing. Ids that are not the caller's are left out silently.
    """
    profile = await profile_service.get_or_create_profile(db, user_id)
    exported_at = datetime.now(timezones.resolve(profile.timezone))
    content = await finance_service.export_expenses(
        db,
        user_id,
        payload.expense_ids,
        filters=payload.filters,
        display_currency=profile.display_currency,
        exported_at=exported_at,
    )
    filename = f"transactions-{exported_at:%Y-%m-%d}.xlsx"
    return Response(
        content=content,
        media_type=finance_service.XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/expenses/import/template",
    response_class=Response,
    responses={200: {"content": {finance_service.XLSX_MEDIA_TYPE: {}}}},
)
async def download_import_template(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """An empty .xlsx to fill in and import, with drop-downs of the caller's
    categories and the supported currencies."""
    profile = await profile_service.get_or_create_profile(db, user_id)
    content = await finance_service.import_template(
        db, user_id, default_currency=profile.preferred_currency
    )
    return Response(
        content=content,
        media_type=finance_service.XLSX_MEDIA_TYPE,
        headers={"Content-Disposition": 'attachment; filename="expenses-template.xlsx"'},
    )


# The file is the request body itself. One file and no other fields need no
# form encoding, and parsing multipart forms would add a dependency
# (python-multipart) for nothing a raw body can't carry.
_UPLOAD = {
    "requestBody": {
        "required": True,
        "content": {"application/octet-stream": {"schema": {"type": "string", "format": "binary"}}},
    }
}


async def _uploaded_file(request: Request) -> bytes:
    """The body, refused as soon as it passes the size cap rather than after
    the whole of an oversized upload has been held in memory."""
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > finance_service.MAX_IMPORT_BYTES:
            limit = finance_service.MAX_IMPORT_BYTES // (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail={
                    "code": "IMPORT_FILE_TOO_LARGE",
                    "message": f"That file is over {limit} MB. Split it into smaller files "
                    "and import them one at a time.",
                },
            )
        chunks.append(chunk)
    return b"".join(chunks)


@router.post(
    "/expenses/import/preview", response_model=ExpenseImportPreviewRead, openapi_extra=_UPLOAD
)
async def preview_expense_import(
    request: Request,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ExpenseImportPreviewRead:
    """Read an .xlsx or CSV file and say what importing it would do: the rows
    ready to import, likely duplicates, and the problems keeping rows out.
    Saves nothing."""
    content = await _uploaded_file(request)
    profile = await profile_service.get_or_create_profile(db, user_id)
    try:
        preview = await finance_service.preview_import(
            db, user_id, content, default_currency=profile.preferred_currency
        )
    except finance_service.FinanceError as exc:
        raise _as_http(exc) from exc
    return ExpenseImportPreviewRead.model_validate(preview)


@router.post(
    "/expenses/import",
    response_model=ExpenseImportResultRead,
    status_code=status.HTTP_201_CREATED,
    openapi_extra=_UPLOAD,
)
async def import_expenses(
    request: Request,
    include_duplicates: bool = False,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ExpenseImportResultRead:
    """Import the ready rows of the same file the preview read, in one
    transaction, creating the categories they name that don't exist yet.

    Rows with problems are left out. So are likely duplicates, unless
    `include_duplicates` is true.
    """
    content = await _uploaded_file(request)
    profile = await profile_service.get_or_create_profile(db, user_id)
    try:
        result = await finance_service.import_expenses(
            db,
            user_id,
            content,
            default_currency=profile.preferred_currency,
            include_duplicates=include_duplicates,
        )
    except finance_service.FinanceError as exc:
        raise _as_http(exc) from exc
    return ExpenseImportResultRead.model_validate(result)


@router.post("/expenses", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
async def create_expense(
    payload: ExpenseCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ExpenseRead:
    try:
        expense = await finance_service.create_expense(db, user_id, payload)
    except finance_service.FinanceError as exc:
        raise _as_http(exc) from exc
    return ExpenseRead.model_validate(expense)


@router.patch("/expenses/{expense_id}", response_model=ExpenseRead)
async def update_expense(
    expense_id: uuid.UUID,
    payload: ExpenseUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ExpenseRead:
    try:
        expense = await finance_service.update_expense(db, user_id, expense_id, payload)
    except finance_service.FinanceError as exc:
        raise _as_http(exc) from exc
    return ExpenseRead.model_validate(expense)


@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    expense_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    try:
        await finance_service.delete_expense(db, user_id, expense_id)
    except finance_service.FinanceError as exc:
        raise _as_http(exc) from exc


# --- Budgets ------------------------------------------------------------------


@router.get("/budgets", response_model=list[BudgetRead])
async def list_budgets(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[BudgetRead]:
    budgets = await finance_service.list_budgets(db, user_id)
    return [BudgetRead.model_validate(b) for b in budgets]


@router.get("/budgets/progress", response_model=list[BudgetProgressRead])
async def read_budget_progress(
    month: date | None = Query(
        default=None,
        description="Any day in the month to report on; defaults to the user's current month.",
    ),
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[BudgetProgressRead]:
    """The budgets that apply to a month, with spend measured against each cap.

    A monthly budget is measured over that month alone; a custom one over its
    whole range, in every month it touches. Separate from GET /budgets rather
    than folded into it: this one converts currencies, and the forms that only
    need the list of budgets should not pay for an exchange-rate lookup.
    """
    if month is None:
        profile = await profile_service.get_or_create_profile(db, user_id)
        month = _today_in(profile.timezone)
    try:
        progress = await finance_service.budget_progress(db, user_id, month=month)
    except finance_service.FinanceError as exc:
        raise _as_http(exc) from exc
    return [BudgetProgressRead.model_validate(p) for p in progress]


@router.post("/budgets", response_model=BudgetRead, status_code=status.HTTP_201_CREATED)
async def create_budget(
    payload: BudgetCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> BudgetRead:
    try:
        budget = await finance_service.create_budget(db, user_id, payload)
    except finance_service.FinanceError as exc:
        raise _as_http(exc) from exc
    return BudgetRead.model_validate(budget)


@router.patch("/budgets/{budget_id}", response_model=BudgetRead)
async def update_budget(
    budget_id: uuid.UUID,
    payload: BudgetUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> BudgetRead:
    try:
        budget = await finance_service.update_budget(db, user_id, budget_id, payload)
    except finance_service.FinanceError as exc:
        raise _as_http(exc) from exc
    return BudgetRead.model_validate(budget)


@router.delete("/budgets/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(
    budget_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    try:
        await finance_service.delete_budget(db, user_id, budget_id)
    except finance_service.FinanceError as exc:
        raise _as_http(exc) from exc


# --- Subscriptions ------------------------------------------------------------


@router.get("/subscriptions", response_model=list[SubscriptionRead])
async def list_subscriptions(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[SubscriptionRead]:
    """Live subscriptions first, soonest charge first; cancelled ones last."""
    subscriptions = await finance_service.list_subscriptions(db, user_id)
    return [SubscriptionRead.model_validate(s) for s in subscriptions]


@router.post("/subscriptions", response_model=SubscriptionRead, status_code=status.HTTP_201_CREATED)
async def create_subscription(
    payload: SubscriptionCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionRead:
    profile = await profile_service.get_or_create_profile(db, user_id)
    try:
        subscription = await finance_service.create_subscription(
            db, user_id, payload, today=_today_in(profile.timezone)
        )
    except finance_service.FinanceError as exc:
        raise _as_http(exc) from exc
    return SubscriptionRead.model_validate(subscription)


@router.patch("/subscriptions/{subscription_id}", response_model=SubscriptionRead)
async def update_subscription(
    subscription_id: uuid.UUID,
    payload: SubscriptionUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionRead:
    """Partial update. Send cancelled_on to cancel, or null to resume."""
    profile = await profile_service.get_or_create_profile(db, user_id)
    try:
        subscription = await finance_service.update_subscription(
            db, user_id, subscription_id, payload, today=_today_in(profile.timezone)
        )
    except finance_service.FinanceError as exc:
        raise _as_http(exc) from exc
    return SubscriptionRead.model_validate(subscription)


@router.post("/subscriptions/{subscription_id}/renew", response_model=SubscriptionRead)
async def renew_subscription(
    subscription_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionRead:
    """Renew ahead of the next charge: log it as an expense today and move the
    subscription on to the charge after. 409 when a cancellation stops it."""
    profile = await profile_service.get_or_create_profile(db, user_id)
    try:
        subscription = await finance_service.renew_subscription(
            db, user_id, subscription_id, today=_today_in(profile.timezone)
        )
    except finance_service.FinanceError as exc:
        raise _as_http(exc) from exc
    return SubscriptionRead.model_validate(subscription)


@router.delete("/subscriptions/{subscription_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subscription(
    subscription_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    try:
        await finance_service.delete_subscription(db, user_id, subscription_id)
    except finance_service.FinanceError as exc:
        raise _as_http(exc) from exc


# --- Reference data -----------------------------------------------------------


@router.get("/currencies", response_model=list[str])
async def list_currencies(db: AsyncSession = Depends(get_db)) -> list[str]:
    """Currency codes new entries may use: those the rate provider still quotes.

    Served rather than duplicated in the frontend so the picker cannot drift
    from what the services actually validate against. A delisted currency is
    left out; the picker still shows it on a row already stored in it.
    Unauthenticated on purpose: it is identical for everyone.
    """
    return sorted(await exchange_rates.supported_currencies(db))


# --- Summary ------------------------------------------------------------------


@router.get("/summary", response_model=SummaryRead)
async def read_summary(
    start_date: date,
    end_date: date,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> SummaryRead:
    """Spent, budgeted and remaining for a date range, in the display currency."""
    profile = await profile_service.get_or_create_profile(db, user_id)
    try:
        totals = await finance_service.summarize(
            db,
            user_id,
            start_date=start_date,
            end_date=end_date,
            display_currency=profile.display_currency,
        )
    except finance_service.FinanceError as exc:
        raise _as_http(exc) from exc
    return SummaryRead.model_validate(totals)


@router.get("/summary/by-category", response_model=CategoryBreakdownRead)
async def read_category_breakdown(
    start_date: date,
    end_date: date,
    category_ids: Annotated[list[uuid.UUID] | None, Query()] = None,
    include_uncategorized: bool = True,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> CategoryBreakdownRead:
    """Spend per category over a date range, in the display currency.

    Both filter parameters are optional and default to everything. `category_ids`
    absent means every category, including any created since the caller last
    looked; `include_uncategorized` switches off the bucket holding spend whose
    category was deleted, which has no id to name it by.
    """
    profile = await profile_service.get_or_create_profile(db, user_id)
    try:
        breakdown = await finance_service.summarize_by_category(
            db,
            user_id,
            start_date=start_date,
            end_date=end_date,
            display_currency=profile.display_currency,
            category_ids=category_ids,
            include_uncategorized=include_uncategorized,
        )
    except finance_service.FinanceError as exc:
        raise _as_http(exc) from exc
    return CategoryBreakdownRead.model_validate(breakdown)


@router.get("/summary/by-period", response_model=PeriodBreakdownRead)
async def read_period_breakdown(
    start_date: date,
    end_date: date,
    granularity: Granularity = "week",
    category_ids: Annotated[list[uuid.UUID] | None, Query()] = None,
    include_uncategorized: bool = True,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> PeriodBreakdownRead:
    """Spend per day or per calendar week over a range, in the display currency.

    The bar chart picks the granularity from how long the range is, so that a
    week shows seven bars and a quarter shows thirteen rather than ninety.

    Both filter parameters are optional and default to everything. `category_ids`
    absent means every category, including any created since the caller last
    looked; `include_uncategorized` switches off the bucket holding spend whose
    category was deleted, which has no id to name it by.
    """
    profile = await profile_service.get_or_create_profile(db, user_id)
    try:
        breakdown = await finance_service.summarize_by_period(
            db,
            user_id,
            start_date=start_date,
            end_date=end_date,
            granularity=granularity,
            display_currency=profile.display_currency,
            category_ids=category_ids,
            include_uncategorized=include_uncategorized,
        )
    except finance_service.FinanceError as exc:
        raise _as_http(exc) from exc
    return PeriodBreakdownRead.model_validate(breakdown)
