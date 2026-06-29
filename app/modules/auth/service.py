"""
AI-Sourcing Hub — Authentication Service

Handles:
    - User registration with bcrypt password hashing
    - Profile creation for clients and suppliers
    - Login with credential verification
    - JWT access + refresh token generation
    - Token refresh
    - Logout (refresh token blacklisting in Redis)
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

import bcrypt
import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.modules.auth.models import ClientProfile, SupplierProfile, User, UserRole
from app.modules.auth.schemas import UserCreate
from app.shared.exceptions import AuthenticationError, ValidationError


def _hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    # rounds=12 in production (default), 10 in dev for faster iteration
    from app.config import settings
    rounds = 12 if settings.ENVIRONMENT == "production" else 10
    salt = bcrypt.gensalt(rounds=rounds)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def _verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a bcrypt hash."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def _create_access_token(user_id: str) -> str:
    """Create a short-lived JWT access token."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def _create_refresh_token(user_id: str) -> str:
    """Create a long-lived JWT refresh token."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        "type": "refresh",
        "jti": str(uuid.uuid4()),  # Unique token ID for blacklisting
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


async def _create_user_profile(db: AsyncSession, user: User, user_data: UserCreate) -> None:
    """Create the appropriate profile record based on the user's role.

    Args:
        db: Database session.
        user: The newly created User instance.
        user_data: Registration data containing profile fields.

    Raises:
        ValidationError: If required profile fields are missing for the role.
    """
    if user.role == UserRole.CLIENT:
        if not user_data.company_name:
            raise ValidationError(
                message="company_name is required for client registration",
                details={"field": "company_name"},
            )
        profile = ClientProfile(
            user_id=user.id,
            company_name=user_data.company_name,
            preferred_port=user_data.preferred_port,
            contact_number=user_data.contact_number,
        )
        db.add(profile)

    elif user.role == UserRole.AGENT:
        missing = []
        if not user_data.factory_name:
            missing.append("factory_name")
        if not user_data.location_in_china:
            missing.append("location_in_china")
        if missing:
            raise ValidationError(
                message=f"Required fields missing for supplier registration: {', '.join(missing)}",
                details={"missing_fields": missing},
            )
        profile = SupplierProfile(
            user_id=user.id,
            factory_name=user_data.factory_name,
            location_in_china=user_data.location_in_china,
            specialty=user_data.specialty,
            business_registration_number=user_data.business_registration_number,
            # New Leaf 2 fields
            business_license_url=user_data.business_license_url,
            factory_address=user_data.factory_address,
        )
        db.add(profile)

    # Admin — no profile needed


async def register_user(db: AsyncSession, user_data: UserCreate) -> User:
    """Register a new user with role-specific profile.

    Args:
        db: Database session.
        user_data: User registration data including profile fields.

    Returns:
        Created User instance (with profile relationship loaded).

    Raises:
        ValidationError: If email already exists or required profile fields missing.
    """
    # Check for existing user — use generic message to prevent email enumeration
    result = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    if result.scalar_one_or_none():
        raise ValidationError(
            message="Registration failed. Please check your details and try again.",
        )

    # Determine role from payload
    if not user_data.role:
        raise ValidationError(
            message="Role is required. Must be one of: client, agent, admin",
            details={"valid_roles": [r.value for r in UserRole]},
        )
    try:
        role_value = UserRole(user_data.role)
    except ValueError:
        raise ValidationError(
            message=f"Invalid role '{user_data.role}'. Must be one of: {', '.join(r.value for r in UserRole)}",
            details={"valid_roles": [r.value for r in UserRole]},
        )

    # Create user
    user = User(
        email=user_data.email,
        password_hash=_hash_password(user_data.password),
        full_name=user_data.full_name,
        phone=user_data.phone,
        role=role_value,
    )
    db.add(user)
    await db.flush()

    # Create role-specific profile
    await _create_user_profile(db, user, user_data)
    await db.flush()

    # Re-fetch with eagerly loaded profiles to avoid lazy-load issues with aiosqlite
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.client_profile),
            selectinload(User.supplier_profile),
        )
        .where(User.id == user.id)
    )
    user = result.scalar_one()
    return user


async def authenticate_user(
    db: AsyncSession, email: str, password: str
) -> User:
    """Authenticate a user by email and password.

    Args:
        db: Database session.
        email: User email.
        password: Plain-text password.

    Returns:
        Authenticated User instance.

    Raises:
        AuthenticationError: If credentials are invalid.
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        raise AuthenticationError(
            message="Invalid email or password",
        )

    if not _verify_password(password, user.password_hash):
        raise AuthenticationError(
            message="Invalid email or password",
        )

    if not user.is_active:
        raise AuthenticationError(
            message="User account is deactivated",
        )

    return user


async def create_tokens(user: User) -> dict:
    """Create access and refresh token pair.

    Args:
        user: Authenticated User instance.

    Returns:
        Dict with access_token, refresh_token, token_type, expires_in.
    """
    access_token = _create_access_token(str(user.id))
    refresh_token = _create_refresh_token(str(user.id))

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


async def refresh_access_token(
    db: AsyncSession, refresh_token: str, redis=None
) -> dict:
    """Validate a refresh token and issue a new token pair (Refresh Token Rotation).

    The old refresh token is blacklisted immediately so it cannot be reused,
    preventing replay attacks even if the token is intercepted.

    Args:
        db: Database session.
        refresh_token: JWT refresh token.
        redis: Redis client (optional — blacklisting skipped if unavailable).

    Returns:
        New token pair dict with fresh access + refresh tokens.
    """
    try:
        payload = jwt.decode(
            refresh_token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError:
        raise AuthenticationError(
            message="Refresh token has expired. Please login again.",
        )
    except jwt.InvalidTokenError:
        raise AuthenticationError(
            message="Invalid refresh token",
        )

    if payload.get("type") != "refresh":
        raise AuthenticationError(
            message="Invalid token type. Expected refresh token.",
        )

    raw_user_id = payload.get("sub")
    if not raw_user_id:
        raise AuthenticationError(
            message="Invalid refresh token payload",
        )

    # Convert string UUID to UUID object for SQLAlchemy binding
    try:
        user_id = UUID(raw_user_id)
    except ValueError:
        raise AuthenticationError(
            message="Invalid user ID in refresh token",
        )

    # Reject already-blacklisted refresh tokens (replay attack prevention)
    jti = payload.get("jti")
    if redis and jti:
        already_used = await redis.get(f"blacklisted:{jti}")
        if already_used:
            raise AuthenticationError(
                message="Refresh token has already been used. Please login again.",
                details={"expired": True},
            )

    # Verify user still exists and is active
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise AuthenticationError(
            message="User not found or deactivated",
        )

    # Blacklist the old refresh token immediately (Refresh Token Rotation).
    # TTL is set to the remaining lifetime of the token so Redis auto-cleans it.
    if redis and jti:
        exp = payload.get("exp")
        if exp:
            ttl = max(1, exp - int(datetime.now(timezone.utc).timestamp()))
            await redis.setex(f"blacklisted:{jti}", ttl, "true")

    return await create_tokens(user)


async def logout_user(redis, refresh_token: str) -> None:
    """Blacklist a refresh token during logout.

    Args:
        redis: Redis client.
        refresh_token: JWT refresh token to blacklist.
    """
    try:
        payload = jwt.decode(
            refresh_token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        jti = payload.get("jti")
        exp = payload.get("exp")
        user_id = payload.get("sub")

        if jti and exp:
            ttl = max(0, exp - int(datetime.now(timezone.utc).timestamp()))
            await redis.setex(f"blacklisted:{jti}", ttl, "true")

        # Invalidate all access tokens issued before this moment for this user.
        # Any access token with iat <= this timestamp will be rejected.
        if user_id:
            logout_ts = int(datetime.now(timezone.utc).timestamp())
            ttl_session = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
            await redis.setex(
                f"session_invalidated:{user_id}",
                ttl_session,
                str(logout_ts),
            )
    except jwt.InvalidTokenError:
        # Ignore invalid tokens during logout
        pass


async def get_user_by_id(db: AsyncSession, user_id: str) -> Optional[User]:
    """Get a user by ID.

    Args:
        db: Database session.
        user_id: User UUID string.

    Returns:
        User instance or None.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
