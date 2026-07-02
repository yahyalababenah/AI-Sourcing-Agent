"""
AI-Sourcing Hub — Token Blacklist / Session Invalidation Tests

Covers two independent Redis-backed invalidation mechanisms found in
``app.modules.auth``:
  1. Refresh-token replay prevention via ``blacklisted:{jti}`` (service.py).
  2. Whole-session invalidation via ``session_invalidated:{user_id}``,
     comparing an access token's ``iat`` against the last logout timestamp
     (dependencies.py — used by ``get_current_user``).

``get_current_user`` calls the *module-level* ``get_redis()`` singleton
directly rather than the FastAPI-injected ``get_redis_client`` dependency, so
tests that need to control its Redis view must monkeypatch
``app.modules.auth.dependencies.get_redis`` directly (patching the
dependency-injected client, as other tests do, has no effect on this
particular check). This asymmetry is itself worth knowing: any endpoint that
relies on this fail-open Redis check is effectively untested by tests which
only override the FastAPI dependency.
"""
from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.config import settings
from app.modules.auth.service import (
    _create_access_token,
    create_tokens,
    logout_user,
    refresh_access_token,
)
from app.shared.exceptions import AuthenticationError


class TestRefreshTokenReplayPrevention:
    @pytest.mark.asyncio
    async def test_reusing_old_refresh_token_after_rotation_is_rejected(
        self, db_session, make_user, redis_client,
    ):
        user = await make_user(role="agent")
        tokens = await create_tokens(user)

        # First refresh succeeds and blacklists the original jti.
        await refresh_access_token(db_session, tokens["refresh_token"], redis=redis_client)

        # Reusing the same (now-rotated) refresh token must be rejected.
        with pytest.raises(AuthenticationError, match="already been used"):
            await refresh_access_token(db_session, tokens["refresh_token"], redis=redis_client)

    @pytest.mark.asyncio
    async def test_blacklist_key_has_ttl_matching_remaining_token_lifetime(
        self, db_session, make_user, redis_client,
    ):
        user = await make_user(role="agent")
        tokens = await create_tokens(user)
        jti = jwt.decode(tokens["refresh_token"], settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])["jti"]

        await refresh_access_token(db_session, tokens["refresh_token"], redis=redis_client)

        ttl = await redis_client.ttl(f"blacklisted:{jti}")
        # Full refresh-token lifetime is REFRESH_TOKEN_EXPIRE_DAYS; TTL should
        # be close to that (minus the few ms this test took to run).
        assert 0 < ttl <= settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400

    @pytest.mark.asyncio
    async def test_refresh_without_redis_skips_blacklist_check(self, db_session, make_user):
        """redis=None (unavailable) must not block the refresh flow itself."""
        user = await make_user(role="agent")
        tokens = await create_tokens(user)
        new_tokens = await refresh_access_token(db_session, tokens["refresh_token"], redis=None)
        assert new_tokens["access_token"]


class TestLogoutBlacklisting:
    @pytest.mark.asyncio
    async def test_logout_blacklists_refresh_jti(self, db_session, make_user, redis_client):
        user = await make_user(role="agent")
        tokens = await create_tokens(user)
        jti = jwt.decode(tokens["refresh_token"], settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])["jti"]

        await logout_user(redis_client, tokens["refresh_token"])

        assert await redis_client.get(f"blacklisted:{jti}") == "true"

    @pytest.mark.asyncio
    async def test_logout_sets_session_invalidated_timestamp(self, db_session, make_user, redis_client):
        user = await make_user(role="agent")
        tokens = await create_tokens(user)

        before = int(datetime.now(timezone.utc).timestamp())
        await logout_user(redis_client, tokens["refresh_token"])
        after = int(datetime.now(timezone.utc).timestamp())

        stored = await redis_client.get(f"session_invalidated:{user.id}")
        assert stored is not None
        assert before <= int(stored) <= after

    @pytest.mark.asyncio
    async def test_logout_with_invalid_token_does_not_raise(self, redis_client):
        """Logout must swallow a malformed token rather than error out."""
        await logout_user(redis_client, "not-a-real-jwt")  # should not raise


class TestSessionInvalidationOnAccessToken:
    """get_current_user rejects access tokens issued before the last logout."""

    @pytest.mark.asyncio
    async def test_access_token_issued_before_logout_is_rejected(
        self, monkeypatch, db_session, make_user, redis_client,
    ):
        import app.modules.auth.dependencies as deps

        async def _fake_get_redis():
            return redis_client

        monkeypatch.setattr(deps, "get_redis", _fake_get_redis)

        user = await make_user(role="agent")
        old_token = _create_access_token(str(user.id))

        # Simulate a logout that happens strictly after the token's iat.
        old_iat = jwt.decode(old_token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])["iat"]
        await redis_client.set(f"session_invalidated:{user.id}", str(old_iat + 1))

        with pytest.raises(AuthenticationError, match="Session has been invalidated"):
            await deps.get_current_user(authorization=f"Bearer {old_token}", db=db_session)

    @pytest.mark.asyncio
    async def test_access_token_issued_after_logout_is_accepted(
        self, monkeypatch, db_session, make_user, redis_client,
    ):
        import app.modules.auth.dependencies as deps

        async def _fake_get_redis():
            return redis_client

        monkeypatch.setattr(deps, "get_redis", _fake_get_redis)

        user = await make_user(role="agent")

        # Logout recorded strictly before the new token is minted.
        past_ts = int(datetime.now(timezone.utc).timestamp()) - 3600
        await redis_client.set(f"session_invalidated:{user.id}", str(past_ts))

        new_token = _create_access_token(str(user.id))
        result = await deps.get_current_user(authorization=f"Bearer {new_token}", db=db_session)
        assert result.id == user.id

    @pytest.mark.asyncio
    async def test_fail_open_when_redis_unavailable(self, monkeypatch, db_session, make_user):
        """Documented tradeoff (see TESTING_FINDINGS.md): if Redis raises,
        access is granted rather than denied — availability over strict
        session-invalidation enforcement."""
        import app.modules.auth.dependencies as deps

        async def _raise_get_redis():
            raise ConnectionError("redis unreachable")

        monkeypatch.setattr(deps, "get_redis", _raise_get_redis)

        user = await make_user(role="agent")
        token = _create_access_token(str(user.id))
        result = await deps.get_current_user(authorization=f"Bearer {token}", db=db_session)
        assert result.id == user.id
