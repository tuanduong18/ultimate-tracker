"""Run one background job from the command line: ``python -m app.tasks <job>``.

For schedulers that run a command rather than call a URL (cron, a Render cron
job, a GitHub Actions step with DATABASE_URL set). Exits non-zero on failure,
so the scheduler's own alerting sees it.
"""

import argparse
import asyncio
from collections.abc import Awaitable, Callable

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import SessionLocal, engine
from app.tasks import jobs

JOBS: dict[str, Callable[[AsyncSession], Awaitable[BaseModel]]] = {
    "budgets": jobs.budgets,
    "exchange-rates": jobs.refresh_exchange_rates,
    "subscriptions": jobs.subscriptions,
}


async def _run(name: str) -> None:
    try:
        async with SessionLocal() as db:
            result = await JOBS[name](db)
        print(result.model_dump_json())
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.tasks")
    parser.add_argument("job", choices=sorted(JOBS))
    asyncio.run(_run(parser.parse_args().job))


if __name__ == "__main__":
    main()
