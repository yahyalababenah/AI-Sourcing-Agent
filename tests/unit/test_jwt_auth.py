"""
AI-Sourcing Hub — JWT Issuance / Refresh / Role Permission Tests

Covers ``app.modules.auth.service`` token creation + refresh and
``app.modules.auth.dependencies.require_role`` — see
``tests/unit/test_token_blacklist.py`` for Redis-backed invalidation tests.
"""
from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.config import settings
from app.modules.auth.dependencies import require_role
from app.modules.auth.models import UserRole
from app.modules.auth.service import (
    _create_access_token,
    _create_refresh_token,
    authenticate_user,
    create_tokens,
    refresh_access_token,
    register_user,
)
from app.shared.exceptions import AuthenticationError


def _decode(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])


class TestTokenIssuance:
    def test_access_token_claims(self):
        token = _create_access_token("user-123")
        payload = _decode(token)
        assert payload["sub"] == "user-123"
        assert payload["type"] == "access"
        assert "iat" in payload
        assert "exp" in payload
        assert "jti" not in payload  # only refresh tokens carry a jti

    def test_access_token_expires_after_configured_minutes(self):
        token = _create_access_token("user-123")
        payload = _decode(token)
        lifetime = payload["exp"] - payload["iat"]
        assert lifetime == settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60

    def test_refresh_token_claims_include_unique_jti(self):
        token = _create_refresh_token("user-123")
        payload = _decode(token)
        assert payload["sub"] == "user-123"
        assert payload["type"] == "refresh"
        assert "jti" in payload

    def test_two_refresh_tokens_have_different_jti(self):
        t1 = _create_refresh_token("user-123")
        t2 = _create_refresh_token("user-123")
        assert _decode(t1)["jti"] != _decode(t2)["jti"]

    @pytest.mark.asyncio
    async def test_create_tokens_returns_bearer_pair(self, make_user):
        user = await make_user(role="agent")
        tokens = await create_tokens(user)
        assert tokens["token_type"] == "bearer"
        assert tokens["expires_in"] == settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        assert _decode(tokens["access_token"])["type"] == "access"
        assert _decode(tokens["refresh_token"])["type"] == "refresh"


class TestRegisterAndAuthenticate:
    @pytest.mark.asyncio
    async def test_register_and_authenticate_success(self, db_session):
        from app.modules.auth.schemas import UserCreate

        user = await register_user(
            db_session,
            UserCreate(
                email="jwt_test_agent@example.com",
                password="TestPass123!",
                full_name="JWT Test Agent",
                role="agent",
                factory_name="Test Factory",
                location_in_china="Guangzhou",
            ),
        )
        assert user.role == UserRole.AGENT

        authenticated = await authenticate_user(
            db_session, "jwt_test_agent@example.com", "TestPass123!"
        )
        assert authenticated.id == user.id

    @pytest.mark.asyncio
    async def test_authenticate_wrong_password_raises(self, db_session):
        from app.modules.auth.schemas import UserCreate

        await register_user(
            db_session,
            UserCreate(
                email="jwt_wrongpass@example.com",
                password="TestPass123!",
                full_name="Test",
                role="agent",
                factory_name="Factory",
                location_in_china="Guangzhou",
            ),
        )
        with pytest.raises(AuthenticationError):
            await authenticate_user(db_session, "jwt_wrongpass@example.com", "wrongpass")

    @pytest.mark.asyncio
    async def test_authenticate_inactive_user_raises(self, db_session, make_user):
        from tests.test_config import TEST_PASSWORD

        # is_active is checked only after password verification succeeds, so
        # the factory's default (TEST_PASSWORD-hashed) user must be used here.
        user = await make_user(role="agent", is_active=False, email="inactive@example.com")
        with pytest.raises(AuthenticationError, match="deactivated"):
            await authenticate_user(db_session, user.email, TEST_PASSWORD)


class TestRefreshAccessToken:
    @pytest.mark.asyncio
    async def test_refresh_issues_new_pair(self, db_session, make_user, redis_client):
        user = await make_user(role="agent")
        tokens = await create_tokens(user)

        new_tokens = await refresh_access_token(db_session, tokens["refresh_token"], redis=redis_client)
        # jti is randomized per refresh token regardless of same-second iat/exp,
        # so this is the reliable rotation signal (access tokens can be
        # byte-identical if minted within the same second).
        assert _decode(new_tokens["refresh_token"])["jti"] != _decode(tokens["refresh_token"])["jti"]

    @pytest.mark.asyncio
    async def test_refresh_with_expired_token_raises(self, db_session, make_user, redis_client):
        user = await make_user(role="agent")
        expired_payload = {
            "sub": str(user.id),
            "iat": datetime.now(timezone.utc) - timedelta(days=10),
            "exp": datetime.now(timezone.utc) - timedelta(days=3),
            "type": "refresh",
            "jti": "expired-jti",
        }
        expired_token = jwt.encode(expired_payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

        with pytest.raises(AuthenticationError, match="expired"):
            await refresh_access_token(db_session, expired_token, redis=redis_client)

    @pytest.mark.asyncio
    async def test_refresh_with_access_token_type_rejected(self, db_session, make_user, redis_client):
        """An access token (not refresh) presented to /refresh must be rejected."""
        user = await make_user(role="agent")
        access_token = _create_access_token(str(user.id))
        with pytest.raises(AuthenticationError, match="Expected refresh token"):
            await refresh_access_token(db_session, access_token, redis=redis_client)

    @pytest.mark.asyncio
    async def test_refresh_with_malformed_token_rejected(self, db_session, redis_client):
        with pytest.raises(AuthenticationError, match="Invalid refresh token"):
            await refresh_access_token(db_session, "not-a-real-jwt", redis=redis_client)


class TestRequireRole:
    @pytest.mark.asyncio
    async def test_matching_role_passes(self, make_user):
        checker = require_role(UserRole.ADMIN)
        user = await make_user(role="admin")
        # require_role's inner function only raises on mismatch; no exception == pass
        await checker(current_user=user)

    @pytest.mark.asyncio
    async def test_mismatched_role_raises_authorization_error(self, make_user):
        from app.shared.exceptions import AuthorizationError

        checker = require_role(UserRole.ADMIN)
        user = await make_user(role="client")
        with pytest.raises(AuthorizationError):
            await checker(current_user=user)

    @pytest.mark.asyncio
    async def test_multi_role_checker_accepts_any_listed_role(self, make_user):
        checker = require_role(UserRole.AGENT, UserRole.ADMIN)
        agent = await make_user(role="agent")
        admin = await make_user(role="admin")
        await checker(current_user=agent)
        await checker(current_user=admin)
