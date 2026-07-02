"""Application configuration, loaded from environment variables / .env."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    project_name: str = "Ultimate Tracker API"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"

    # Database — async SQLAlchemy URL (asyncpg driver).
    database_url: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/ultimate_tracker"
    )

    # Supabase JWT verification. Tokens are signed with the project's
    # asymmetric JWT Signing Keys (ES256); we verify against the public keys
    # published at the project's JWKS endpoint:
    # https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json
    supabase_jwks_url: str = ""
    supabase_jwt_audience: str = "authenticated"

    # CORS — origins allowed to call the API. Override via env as a JSON list.
    cors_origins: list[str] = ["http://localhost:3000"]

    # Observability.
    sentry_dsn: str | None = None


settings = Settings()
