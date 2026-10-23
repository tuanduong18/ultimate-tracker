"""Logging, configured once when the app starts.

Driven by ENVIRONMENT, so the same code runs everywhere and only the setting
decides the format: JSON in deployments, readable console text on a laptop.

There is deliberately no error-reporting service (Sentry and the like): the
app's users are its author and a few friends, who see failures on screen. The
one thing nobody watches is the scheduled jobs, and their failures are log
lines at ``level: error`` — searchable because they arrive as JSON.
"""

import logging
from typing import Any

import structlog

from app.core.config import Settings

# Environments that get console logs instead of JSON. Anything else — Render
# sets ENVIRONMENT=production — is treated as a deployment.
_LOCAL_ENVIRONMENTS = frozenset({"development", "test"})


def configure_logging(settings: Settings) -> None:
    """One JSON object per line in deployments, coloured key=value text locally.

    JSON because a deployment's logs are read by tools — Render's log search,
    any aggregator added later — and a field is only searchable if it arrives
    as a field. The call sites already log that way
    (``logger.warning("exchange_rates.stale", age_hours=...)``); until this ran,
    structlog's unconfigured default flattened them into plain text.
    """
    local = settings.environment in _LOCAL_ENVIRONMENTS
    renderer: Any = (
        structlog.dev.ConsoleRenderer() if local else structlog.processors.JSONRenderer()
    )
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )
