"""JWT verification — every protected route depends on get_current_user_id.

Supabase signs access tokens with the project's asymmetric JWT Signing Keys
(ES256). We verify the signature against the public keys published at the
project's JWKS endpoint; we never trust an unverified token. PyJWKClient
caches the fetched keys, so verification does not hit the network per request.

Every rejection here returns 401 with a stable ``code`` in the standard error
envelope, so the frontend can tell "not signed in" apart from "signed in but
not allowed". The one exception is a JWKS outage: that is our failure, not the
caller's, and it answers 503.
"""

import uuid
from functools import lru_cache
from typing import Any

import jwt
import structlog
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.concurrency import run_in_threadpool

from app.core.config import settings

logger = structlog.get_logger(__name__)

# auto_error=False: FastAPI's built-in rejection is a bare 403 "Not authenticated"
# that never reaches our error envelope with a usable code. We raise our own.
bearer_scheme = HTTPBearer(auto_error=False)

# RFC 6750: a 401 on a Bearer-protected resource has to say which scheme failed.
_WWW_AUTHENTICATE = {"WWW-Authenticate": "Bearer"}


def _unauthorized(code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": code, "message": message},
        headers=_WWW_AUTHENTICATE,
    )


@lru_cache(maxsize=1)
def _jwks_client() -> jwt.PyJWKClient:
    """Return the shared JWKS client, failing loudly if the URL is not set."""
    if not settings.supabase_jwks_url:
        raise RuntimeError(
            "SUPABASE_JWKS_URL is not configured — set it to "
            "https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json"
        )
    return jwt.PyJWKClient(settings.supabase_jwks_url, cache_keys=True)


def _verify_token(token: str) -> dict[str, Any]:
    """Resolve the signing key and decode the token. Blocking — run off-loop.

    ``require`` matters as much as the signature check: PyJWT validates ``exp``
    when it is present but does not insist on it, so a token minted without one
    would otherwise verify forever.
    """
    signing_key = _jwks_client().get_signing_key_from_jwt(token)
    payload: dict[str, Any] = jwt.decode(
        token,
        signing_key.key,
        algorithms=settings.supabase_jwt_algorithms,
        audience=settings.supabase_jwt_audience,
        issuer=settings.supabase_jwt_issuer or None,
        options={"require": ["exp", "sub", "aud"]},
    )
    return payload


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> uuid.UUID:
    """Verify the Bearer token and return the Supabase user id (``sub`` claim)."""
    if credentials is None:
        raise _unauthorized("MISSING_TOKEN", "An Authorization: Bearer <token> header is required.")

    try:
        # PyJWKClient fetches the key set over blocking urllib. On a cache miss
        # that would stall the whole event loop, not just this request.
        payload = await run_in_threadpool(_verify_token, credentials.credentials)
    except jwt.PyJWKClientConnectionError as exc:
        # We could not reach Supabase's JWKS endpoint. Calling that an invalid
        # token would sign every user out for the length of someone else's
        # outage, so report it as ours and make it visible in the logs.
        logger.error("jwks_unreachable", jwks_url=settings.supabase_jwks_url, error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "AUTH_UNAVAILABLE",
                "message": "Could not verify credentials right now. Please retry.",
            },
        ) from exc
    except jwt.PyJWTError as exc:
        # Bad signature, expired, wrong audience/issuer, unknown key id, missing
        # required claim. All of them are the caller's problem, and none of the
        # details are safe to echo back.
        raise _unauthorized("INVALID_TOKEN", "Could not validate credentials.") from exc

    try:
        return uuid.UUID(str(payload["sub"]))
    except (KeyError, ValueError) as exc:
        # A verified token whose subject is not a UUID is still unusable: every
        # row we own is keyed by that id.
        raise _unauthorized("INVALID_TOKEN", "Token subject is not a valid user id.") from exc
