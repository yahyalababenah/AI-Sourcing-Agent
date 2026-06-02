"""Authentication request/response Pydantic schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    """User registration request."""

    email: EmailStr = Field(..., examples=["agent@example.com"])
    password: str = Field(..., min_length=8, max_length=128, examples=["secure_password"])
    full_name: str = Field(..., min_length=1, max_length=255, examples=["Ahmed Al-Masri"])
    phone: Optional[str] = Field(None, max_length=50, examples=["+962791234567"])


class UserLogin(BaseModel):
    """User login request."""

    email: EmailStr = Field(..., examples=["agent@example.com"])
    password: str = Field(..., examples=["secure_password"])


class TokenResponse(BaseModel):
    """JWT token pair response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class TokenRefresh(BaseModel):
    """Refresh token request."""

    refresh_token: str


class UserResponse(BaseModel):
    """Public user profile response."""

    id: UUID
    email: str
    full_name: str
    role: str
    phone: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
