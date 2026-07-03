"""
AI-Sourcing Hub — Authentication Dependencies

Provides:
    - get_current_user: Extracts and validates JWT from Authorization header
      (eagerly loads profile relationships to avoid N+1 queries)
    - RoleChecker: Factory for role-based access control

Usage:
    @router.get("/admin-only")
    async def admin_endpoint(
        user: User = Depends(get_current_user),
        _: None = Depends(require_role("admin")),
    ):
        ...
"""

from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.modules.auth.models import User, UserRole
from app.shared.database import get_db
from app.shared.exceptions import AuthenticationError, AuthorizationError
from app.shared.redis_client import get_redis


async def _resolve_user(
    authorization: str | None,
    db: AsyncSession,
    *,
    load_profiles: bool,
) -> User:
    """Validate the Bearer JWT and return the matching active User.

    Args:
        authorization: Raw ``Authorization`` header value.
        db: Async DB session.
        load_profiles: Eagerly load client/supplier profiles. Off on the hot
            path (most endpoints never touch profiles); on only for ``/me``.

    Raises:
        AuthenticationError: If the token is missing, invalid, or expired.
    """
    if not authorization:
        raise AuthenticationError(
            message="Missing Authorization header",
            details={"header": "Authorization: Bearer <token>"},
        )

    # Extract Bearer token
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AuthenticationError(
            message="Invalid Authorization header format",
            details={"expected": "Bearer <token>"},
        )

    token = parts[1]

    # Decode and verify JWT
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError:
        raise AuthenticationError(
            message="Token has expired",
            details={"expired": True},
        )
    except jwt.InvalidTokenError as e:
        raise AuthenticationError(
            message="Invalid token",
            details={"error": str(e)},
        )

    raw_user_id = payload.get("sub")
    if not raw_user_id:
        raise AuthenticationError(
            message="Token missing subject claim",
        )

    # Convert string UUID to UUID object for SQLAlchemy binding
    try:
        user_id = UUID(raw_user_id)
    except ValueError:
        raise AuthenticationError(
            message="Invalid user ID in token",
        )

    # Check if the session was invalidated after this token was issued (logout).
    # One remote Redis GET per request — gated off on single-instance/remote-Redis
    # demos where short-lived access tokens make it not worth the latency.
    # Fail open if Redis is unavailable to avoid locking users out.
    if settings.AUTH_SESSION_CHECK_ENABLED:
        iat = payload.get("iat")
        try:
            redis = await get_redis()
            invalidated_val = await redis.get(f"session_invalidated:{raw_user_id}")
            if invalidated_val and iat is not None:
                if int(iat) <= int(invalidated_val):
                    raise AuthenticationError(
                        message="Session has been invalidated. Please login again.",
                        details={"expired": True},
                    )
        except AuthenticationError:
            raise
        except Exception:
            pass  # Redis unavailable — fail open

    # Fetch user from DB. Profiles are eagerly loaded only when requested — the
    # extra selectinload SELECTs are pure overhead on the vast majority of
    # requests that never read the profile.
    stmt = select(User).where(User.id == user_id)
    if load_profiles:
        stmt = stmt.options(
            selectinload(User.client_profile),
            selectinload(User.supplier_profile),
        )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise AuthenticationError(
            message="User not found",
        )

    if not user.is_active:
        raise AuthenticationError(
            message="User account is deactivated",
        )

    return user


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validate the Bearer JWT and return the active User (no profiles loaded).

    The default auth dependency for protected endpoints. Use
    :func:`get_current_user_with_profiles` when the handler needs
    ``client_profile`` / ``supplier_profile``.
    """
    return await _resolve_user(authorization, db, load_profiles=False)


async def get_current_user_with_profiles(
    authorization: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Like :func:`get_current_user` but eagerly loads role-specific profiles.

    Used by endpoints (e.g. ``/me``) that serialise profile data, so accessing
    ``user.client_profile`` / ``user.supplier_profile`` never triggers a lazy
    load in the async context.
    """
    return await _resolve_user(authorization, db, load_profiles=True)


def require_role(*roles: UserRole):
    """Factory for role-based access control dependency.

    Args:
        *roles: Allowed roles (e.g., UserRole.ADMIN, UserRole.AGENT).

    Returns:
        Dependency function that checks the user's role.

    Usage:
        @router.get("/admin-only")
        async def admin_endpoint(
            _: None = Depends(require_role(UserRole.ADMIN)),
        ):
            ...
    """

    async def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> None:
        if current_user.role not in roles:
            raise AuthorizationError(
                message=f"Requires one of: {', '.join(r.value for r in roles)}",
                required_role=" | ".join(r.value for r in roles),
            )

    return role_checker


# Convenience aliases
require_admin = require_role(UserRole.ADMIN)
require_agent = require_role(UserRole.AGENT)
require_client = require_role(UserRole.CLIENT)
require_agent_or_admin = require_role(UserRole.AGENT, UserRole.ADMIN)
require_client_or_admin = require_role(UserRole.CLIENT, UserRole.ADMIN)
require_any_role = require_role  # generic: require_any_role(UserRole.ADMIN, UserRole.AGENT, UserRole.CLIENT)
