"""
AI-Sourcing Hub — Authentication Endpoints

/api/v1/auth/register      POST   Register new user
/api/v1/auth/login         POST   Authenticate, receive JWT pair
/api/v1/auth/refresh       POST   Refresh access token
/api/v1/auth/me            GET    Current user profile
/api/v1/auth/logout        POST   Invalidate refresh token
"""

from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.auth.schemas import (
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


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=201,
    summary="Register new user",
)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    """Register a new sourcing agent account."""
    user = await register_user(db, user_data)
    return UserResponse.model_validate(user)


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
    summary="Get current user profile",
)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """Return the profile of the currently authenticated user."""
    return UserResponse.model_validate(current_user)


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
