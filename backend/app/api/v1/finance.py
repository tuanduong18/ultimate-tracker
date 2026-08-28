"""finance API routes (v1). Keep handlers thin — business logic lives in app/services/."""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.currencies import CURRENCY_CODES
from app.core.security import get_current_user_id
from app.db.session import get_db
from app.schemas.finance import (
    BudgetCreate,
    BudgetRead,
    BudgetUpdate,
    CategoryCreate,
    CategoryRead,
    CategoryUpdate,
    ExpenseCreate,
    ExpenseRead,
    ExpenseUpdate,
    SummaryRead,
)
from app.services import finance as finance_service
from app.services import profile as profile_service

router = APIRouter()


def _as_http(exc: finance_service.FinanceError) -> HTTPException:
    """Translate a domain error into the standard error envelope."""
    return HTTPException(
        status_code=exc.status_code, detail={"code": exc.code, "message": str(exc)}
    )


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


# --- Reference data -----------------------------------------------------------


@router.get("/currencies", response_model=list[str])
async def list_currencies() -> list[str]:
    """Currency codes the API will accept.

    Served rather than duplicated in the frontend so the picker cannot drift
    from what the schemas actually validate against. Unauthenticated on
    purpose: it is a static list, identical for everyone.
    """
    return list(CURRENCY_CODES)


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
