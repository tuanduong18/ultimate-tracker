"""Unit tests for JWT verification (app.core.security).

Tokens are signed with a locally generated ES256 key pair and the JWKS client
is stubbed out, so verification runs exactly as in production minus the
network fetch.
"""

import datetime
import uuid
from types import SimpleNamespace
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.core import security

TEST_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

_private_key = ec.generate_private_key(ec.SECP256R1())
_wrong_key = ec.generate_private_key(ec.SECP256R1())


def make_token(
    sub: str | None = str(TEST_USER_ID),
    aud: str = "authenticated",
    expires_in: int = 3600,
    key: ec.EllipticCurvePrivateKey = _private_key,
) -> str:
    now = datetime.datetime.now(tz=datetime.UTC)
    payload: dict[str, Any] = {
        "aud": aud,
        "iat": now,
        "exp": now + datetime.timedelta(seconds=expires_in),
    }
    if sub is not None:
        payload["sub"] = sub
    return jwt.encode(payload, key, algorithm="ES256")


def as_credentials(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


@pytest.fixture
def stub_jwks_client(monkeypatch: pytest.MonkeyPatch) -> None:
    """Serve the test public key instead of fetching Supabase's JWKS."""
    stub = SimpleNamespace(
        get_signing_key_from_jwt=lambda token: SimpleNamespace(key=_private_key.public_key())
    )
    monkeypatch.setattr(security, "_jwks_client", lambda: stub)


async def test_valid_token_returns_user_id(stub_jwks_client: None) -> None:
    user_id = await security.get_current_user_id(as_credentials(make_token()))
    assert user_id == TEST_USER_ID


async def test_token_signed_with_wrong_key_is_rejected(stub_jwks_client: None) -> None:
    with pytest.raises(HTTPException) as exc_info:
        await security.get_current_user_id(as_credentials(make_token(key=_wrong_key)))
    assert exc_info.value.status_code == 401


async def test_expired_token_is_rejected(stub_jwks_client: None) -> None:
    with pytest.raises(HTTPException) as exc_info:
        await security.get_current_user_id(as_credentials(make_token(expires_in=-60)))
    assert exc_info.value.status_code == 401


async def test_wrong_audience_is_rejected(stub_jwks_client: None) -> None:
    with pytest.raises(HTTPException) as exc_info:
        await security.get_current_user_id(as_credentials(make_token(aud="anon")))
    assert exc_info.value.status_code == 401


async def test_token_without_sub_is_rejected(stub_jwks_client: None) -> None:
    with pytest.raises(HTTPException) as exc_info:
        await security.get_current_user_id(as_credentials(make_token(sub=None)))
    assert exc_info.value.status_code == 401


def test_jwks_client_requires_configured_url() -> None:
    security._jwks_client.cache_clear()
    with pytest.raises(RuntimeError, match="SUPABASE_JWKS_URL"):
        security._jwks_client()
