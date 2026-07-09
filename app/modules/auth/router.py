"""
AI-Sourcing Hub — Authentication Endpoints

/api/v1/auth/register      POST   Register new user (with role-specific profile)
/api/v1/auth/login         POST   Authenticate, receive JWT pair
/api/v1/auth/refresh       POST   Refresh access token
/api/v1/auth/me            GET    Current user profile (includes profile data)
/api/v1/auth/logout        POST   Invalidate refresh token
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.auth.dependencies import (
    get_current_user,
    get_current_user_with_profiles,
)
from app.modules.auth.models import OnboardingStatus, User, UserRole
from app.modules.auth.schemas import (
    TokenRefresh,
    TokenResponse,
    UpdateProfileRequest,
    UserCreate,
    UserLogin,
    UserResponse,
    build_user_response,
)
from app.modules.auth.service import (
    authenticate_user,
    create_tokens,
    logout_user,
    refresh_access_token,
    register_user,
)
from app.shared.database import get_db
from app.shared.redis_client import get_redis_client

router = APIRouter()


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=201,
    summary="Register new user with role-specific profile",
)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user with a role-specific profile.

    - **client**: Creates a ClientProfile (requires company_name)
    - **agent**: Creates a SupplierProfile (requires factory_name, location_in_china)

    Admin accounts cannot be self-registered through this public endpoint —
    requesting role="admin" is rejected. Admin provisioning is an internal
    operation only.
    """
    user = await register_user(db, user_data)
    return build_user_response(user)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate and receive JWT tokens",
)
async def login(
    credentials: UserLogin,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate with email and password. Returns access + refresh tokens."""
    user = await authenticate_user(db, credentials.email, credentials.password)
    tokens = await create_tokens(user)
    return TokenResponse(**tokens)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
)
async def refresh(
    token_data: TokenRefresh,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_client),
):
    """Exchange a valid refresh token for a new access token pair."""
    tokens = await refresh_access_token(db, token_data.refresh_token, redis=redis)
    return TokenResponse(**tokens)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user profile with profile data",
)
async def get_me(
    current_user: User = Depends(get_current_user_with_profiles),
):
    """Return the profile of the currently authenticated user.

    Includes role-specific profile data (ClientProfile or SupplierProfile)
    in the ``profile`` field.
    """
    return build_user_response(current_user)


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="Update current user's profile",
)
async def update_me(
    data: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_profiles),
):
    """Update the authenticated user's name, phone, and role-specific profile fields."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    # Update base user fields
    if data.full_name is not None:
        current_user.full_name = data.full_name
    if data.phone is not None:
        current_user.phone = data.phone
    if data.onboarding_status is not None:
        current_user.onboarding_status = data.onboarding_status
        if data.onboarding_status == OnboardingStatus.COMPLETED:
            current_user.onboarding_completed_at = datetime.now(timezone.utc)

    # Update role-specific profile
    if current_user.role == UserRole.CLIENT and current_user.client_profile:
        p = current_user.client_profile
        if data.company_name is not None:
            p.company_name = data.company_name
        if data.preferred_port is not None:
            p.preferred_port = data.preferred_port
        if data.contact_number is not None:
            p.contact_number = data.contact_number

    elif current_user.role == UserRole.AGENT and current_user.supplier_profile:
        p = current_user.supplier_profile
        if data.factory_name is not None:
            p.factory_name = data.factory_name
        if data.location_in_china is not None:
            p.location_in_china = data.location_in_china
        if data.specialty is not None:
            p.specialty = data.specialty
        if data.factory_address is not None:
            p.factory_address = data.factory_address

    await db.commit()

    # Re-fetch with relationships to build full response
    from app.modules.auth.models import ClientProfile, SupplierProfile
    stmt = (
        select(User)
        .options(selectinload(User.client_profile), selectinload(User.supplier_profile))
        .where(User.id == current_user.id)
    )
    result = await db.execute(stmt)
    refreshed = result.scalar_one()
    return build_user_response(refreshed)


@router.post(
    "/logout",
    status_code=204,
    summary="Logout and invalidate refresh token",
)
async def logout(
    token_data: TokenRefresh,
    redis: Redis = Depends(get_redis_client),
    _current_user: User = Depends(get_current_user),
):
    """Blacklist the refresh token so it can no longer be used."""
    await logout_user(redis, token_data.refresh_token)
