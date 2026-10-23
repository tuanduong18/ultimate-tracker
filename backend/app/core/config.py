"""Application configuration, loaded from environment variables / .env."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    project_name: str = "Ultimate Tracker API"
    # "development" or "test" log as readable text; anything else (Render sets
    # "production") logs JSON — see app/core/observability.py.
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"

    # Database — async SQLAlchemy URL (asyncpg driver).
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ultimate_tracker"

    # Supabase JWT verification. Tokens are signed with the project's
    # asymmetric JWT Signing Keys (ES256); we verify against the public keys
    # published at the project's JWKS endpoint:
    # https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json
    supabase_jwks_url: str = ""
    supabase_jwt_audience: str = "authenticated"
    # Expected `iss` claim: https://<project-ref>.supabase.co/auth/v1. Checked
    # only when set — the JWKS URL already pins verification to one project, so
    # this is defence in depth rather than the primary control.
    supabase_jwt_issuer: str = ""
    # Only the algorithms the project actually signs with. Keeping this narrow
    # means a token cannot ask to be verified some other way; ES256 is what
    # Supabase issues for this project, RS256 is here for projects on RSA keys.
    supabase_jwt_algorithms: list[str] = ["ES256"]

    # CORS — origins allowed to call the API. Override via env as a JSON list.
    cors_origins: list[str] = ["http://localhost:3000"]

    # Exchange rates. open.er-api.com needs no API key and quotes 160+ currencies
    # including VND; the ECB-backed alternatives quote ~30 and omit it.
    exchange_rates_url: str = "https://open.er-api.com/v6/latest/USD"
    # How long a process keeps rates in memory before looking at the table again.
    exchange_rates_ttl_seconds: int = 60 * 60
    # Rates older than this are still served, but every read logs a warning:
    # the scheduled refresh job has stopped running. Two days allows for one
    # missed daily run.
    exchange_rates_stale_after_hours: int = 48
    # A refresh that would delist more currencies than this at once is refused:
    # the provider retires a currency every year or two, so a mass drop means a
    # truncated response, not real news to tell users about.
    exchange_rates_max_delisted_per_refresh: int = 5

    # Background tasks. Each job is exposed as a POST under /api/v1/tasks so any
    # scheduler can trigger it; callers must send this value in X-Task-Secret.
    # Empty disables the endpoints entirely, which is the safe default.
    task_secret: str = ""
    # How many days before a subscription charges (or a trial converts) the
    # reminder goes out. It then stays open until the charge happens or the
    # user acts on it.
    subscription_reminder_lead_days: int = 3


settings = Settings()
