"""JWT verification — every protected route depends on get_current_user_id.

Supabase signs access tokens with the project's asymmetric JWT Signing Keys
(ES256). We verify the signature against the public keys published at the
project's JWKS endpoint; we never trust an unverified token. PyJWKClient
caches the fetched keys, so verification does not hit the network per request.
"""

import uuid
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

bearer_scheme = HTTPBearer(auto_error=True)


@lru_cache(maxsize=1)
def _jwks_client() -> jwt.PyJWKClient:
    """Return the shared JWKS client, failing loudly if the URL is not set."""
    if not settings.supabase_jwks_url:
        raise RuntimeError(
            "SUPABASE_JWKS_URL is not configured — set it to "
            "https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json"
        )
    return jwt.PyJWKClient(settings.supabase_jwks_url, cache_keys=True)


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> uuid.UUID:
    """Verify the Bearer token and return the Supabase user id (``sub`` claim)."""
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(credentials.credentials)
        payload = jwt.decode(
            credentials.credentials,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience=settings.supabase_jwt_audience,
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Could not validate credentials."},
        ) from exc

    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "Token is missing a subject."},
        )
    return uuid.UUID(sub)
