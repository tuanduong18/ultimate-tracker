"""Unit tests for JWT verification (app.core.security).

Tokens are signed with a locally generated ES256 key pair and the JWKS client
is stubbed out, so verification runs exactly as in production minus the
network fetch.
"""

import datetime
import uuid
from collections.abc import Callable
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
    expires_in: int | None = 3600,
    key: ec.EllipticCurvePrivateKey = _private_key,
    issuer: str | None = None,
) -> str:
    now = datetime.datetime.now(tz=datetime.UTC)
    payload: dict[str, Any] = {"aud": aud, "iat": now}
    if expires_in is not None:
        payload["exp"] = now + datetime.timedelta(seconds=expires_in)
    if sub is not None:
        payload["sub"] = sub
    if issuer is not None:
        payload["iss"] = issuer
    return jwt.encode(payload, key, algorithm="ES256")


def as_credentials(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def _stub_jwks(monkeypatch: pytest.MonkeyPatch, get_key: Callable[[str], Any]) -> None:
    stub = SimpleNamespace(get_signing_key_from_jwt=get_key)
    monkeypatch.setattr(security, "_jwks_client", lambda: stub)


@pytest.fixture
def stub_jwks_client(monkeypatch: pytest.MonkeyPatch) -> None:
    """Serve the test public key instead of fetching Supabase's JWKS."""
    _stub_jwks(monkeypatch, lambda token: SimpleNamespace(key=_private_key.public_key()))


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


async def test_token_without_exp_is_rejected(stub_jwks_client: None) -> None:
    """A token with no expiry would otherwise verify forever."""
    with pytest.raises(HTTPException) as exc_info:
        await security.get_current_user_id(as_credentials(make_token(expires_in=None)))
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail["code"] == "INVALID_TOKEN"


async def test_non_uuid_sub_is_rejected_as_401(stub_jwks_client: None) -> None:
    """A verified-but-unusable subject is a 401, not an uncaught 500."""
    with pytest.raises(HTTPException) as exc_info:
        await security.get_current_user_id(as_credentials(make_token(sub="not-a-uuid")))
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail["code"] == "INVALID_TOKEN"


async def test_wrong_issuer_is_rejected_when_configured(
    stub_jwks_client: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        security.settings, "supabase_jwt_issuer", "https://real.supabase.co/auth/v1"
    )
    with pytest.raises(HTTPException) as exc_info:
        await security.get_current_user_id(
            as_credentials(make_token(issuer="https://evil.example/auth/v1"))
        )
    assert exc_info.value.status_code == 401


async def test_matching_issuer_is_accepted_when_configured(
    stub_jwks_client: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    issuer = "https://real.supabase.co/auth/v1"
    monkeypatch.setattr(security.settings, "supabase_jwt_issuer", issuer)
    user_id = await security.get_current_user_id(as_credentials(make_token(issuer=issuer)))
    assert user_id == TEST_USER_ID


async def test_missing_credentials_is_401_not_403() -> None:
    """No Authorization header must answer 401 with a Bearer challenge."""
    with pytest.raises(HTTPException) as exc_info:
        await security.get_current_user_id(None)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail["code"] == "MISSING_TOKEN"
    assert exc_info.value.headers == {"WWW-Authenticate": "Bearer"}


async def test_unreachable_jwks_is_503_not_401(monkeypatch: pytest.MonkeyPatch) -> None:
    """An outage on our side must not look like a bad token to every user."""

    def _unreachable(token: str) -> Any:
        raise jwt.PyJWKClientConnectionError("cannot reach JWKS endpoint")

    _stub_jwks(monkeypatch, _unreachable)
    with pytest.raises(HTTPException) as exc_info:
        await security.get_current_user_id(as_credentials(make_token()))
    assert exc_info.value.status_code == 503
    assert exc_info.value.detail["code"] == "AUTH_UNAVAILABLE"


async def test_unknown_signing_key_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    """An unknown `kid` is a bad token, not an outage — 401, not 503."""

    def _no_such_key(token: str) -> Any:
        raise jwt.PyJWKClientError("Unable to find a signing key that matches")

    _stub_jwks(monkeypatch, _no_such_key)
    with pytest.raises(HTTPException) as exc_info:
        await security.get_current_user_id(as_credentials(make_token()))
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail["code"] == "INVALID_TOKEN"


def test_jwks_client_requires_configured_url(monkeypatch: pytest.MonkeyPatch) -> None:
    # Pin the setting rather than reading it: a developer with a real
    # SUPABASE_JWKS_URL in backend/.env would otherwise fail this test locally
    # while CI, which has no .env, passes.
    monkeypatch.setattr(security.settings, "supabase_jwks_url", "")
    security._jwks_client.cache_clear()
    try:
        with pytest.raises(RuntimeError, match="SUPABASE_JWKS_URL"):
            security._jwks_client()
    finally:
        security._jwks_client.cache_clear()
