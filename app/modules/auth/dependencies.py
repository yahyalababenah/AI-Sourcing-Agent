"""
AI-Sourcing Hub — Authentication Dependencies

Provides:
    - get_current_user: Extracts and validates JWT from Authorization header
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

from app.config import settings
from app.modules.auth.models import User, UserRole
from app.shared.database import get_db
from app.shared.exceptions import AuthenticationError, AuthorizationError


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate JWT from Authorization header.

    Expects: Authorization: Bearer <token>

    Returns:
        User instance if token is valid.

    Raises:
        AuthenticationError: If token is missing, invalid, or expired.
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

    # Fetch user from DB
    result = await db.execute(select(User).where(User.id == user_id))
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
require_agent_or_admin = require_role(UserRole.AGENT, UserRole.ADMIN)
