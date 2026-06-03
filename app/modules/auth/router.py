"""
AI-Sourcing Hub — Authentication Endpoints

/api/v1/auth/register      POST   Register new user (with role-specific profile)
/api/v1/auth/login         POST   Authenticate, receive JWT pair
/api/v1/auth/refresh       POST   Refresh access token
/api/v1/auth/me            GET    Current user profile (includes profile data)
/api/v1/auth/logout        POST   Invalidate refresh token
"""

from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User, UserRole
from app.modules.auth.schemas import (
    ClientProfileResponse,
    SupplierProfileResponse,
    TokenRefresh,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
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


def _build_user_response(user: User) -> UserResponse:
    """Build a UserResponse with the role-specific profile data attached.

    Args:
        user: User instance (with profile relationship loaded).

    Returns:
        UserResponse with nested profile dict.
    """
    profile = None
    if user.role == UserRole.CLIENT and user.client_profile:
        profile = ClientProfileResponse.model_validate(
            user.client_profile
        ).model_dump()
    elif user.role == UserRole.AGENT and user.supplier_profile:
        profile = SupplierProfileResponse.model_validate(
            user.supplier_profile
        ).model_dump()

    user_data = UserResponse.model_validate(user).model_dump()
    user_data["profile"] = profile
    return UserResponse(**user_data)


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
    - **admin**: No profile required
    """
    user = await register_user(db, user_data)
    return _build_user_response(user)


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
):
    """Exchange a valid refresh token for a new access token pair."""
    tokens = await refresh_access_token(db, token_data.refresh_token)
    return TokenResponse(**tokens)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user profile with profile data",
)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """Return the profile of the currently authenticated user.

    Includes role-specific profile data (ClientProfile or SupplierProfile)
    in the ``profile`` field.
    """
    return _build_user_response(current_user)


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
