"""tasks API routes (v1) — trigger endpoints for the background jobs.

For schedulers that call a URL: a GitHub Actions cron, Supabase pg_cron with
pg_net, an uptime pinger. Not user-facing, and not behind the Supabase JWT —
a scheduler has no user. Callers authenticate with the shared X-Task-Secret.

Every job is idempotent, so a retried or doubled call is harmless.
"""

import hmac
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.schemas.task import ExchangeRateRefreshRead
from app.services import exchange_rates
from app.tasks import jobs

logger = structlog.get_logger(__name__)


async def require_task_secret(
    x_task_secret: Annotated[str | None, Header()] = None,
) -> None:
    if not settings.task_secret:
        # Unset means nobody configured a scheduler. Refuse rather than run
        # unauthenticated: an open trigger is a free way to hammer the upstream.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "TASKS_DISABLED", "message": "TASK_SECRET is not configured."},
        )
    # Constant-time, so the secret cannot be recovered a character at a time.
    if x_task_secret is None or not hmac.compare_digest(
        x_task_secret.encode(), settings.task_secret.encode()
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TASK_SECRET", "message": "Missing or wrong X-Task-Secret."},
        )


router = APIRouter(dependencies=[Depends(require_task_secret)])


@router.post("/exchange-rates", response_model=ExchangeRateRefreshRead)
async def refresh_exchange_rates(db: AsyncSession = Depends(get_db)) -> ExchangeRateRefreshRead:
    """Fetch today's rates from the upstream and store them."""
    try:
        return await jobs.refresh_exchange_rates(db)
    except exchange_rates.UPSTREAM_ERRORS as exc:
        logger.warning("exchange_rates.refresh_failed", error=str(exc))
        # The upstream's failure, not ours or the caller's. Reads carry on with
        # the last stored snapshot; the scheduler should retry later.
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "UPSTREAM_UNAVAILABLE", "message": "Could not fetch exchange rates."},
        ) from exc
