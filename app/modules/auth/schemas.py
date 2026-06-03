"""Authentication request/response Pydantic schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


# ═══════════════════════════════════════════════════════════
# Profile Schemas
# ═══════════════════════════════════════════════════════════

class ClientProfileCreate(BaseModel):
    """Profile data required for client registration."""

    company_name: str = Field(..., min_length=1, max_length=255, examples=["Acme Corp"])
    preferred_port: Optional[str] = Field(None, max_length=100, examples=["Aqaba"])
    contact_number: Optional[str] = Field(None, max_length=50, examples=["+962791234567"])


class SupplierProfileCreate(BaseModel):
    """Profile data required for agent/supplier registration."""

    factory_name: str = Field(..., min_length=1, max_length=255, examples=["Future Factory Ltd"])
    location_in_china: str = Field(..., min_length=1, max_length=255, examples=["Guangzhou, Guangdong"])
    specialty: Optional[str] = Field(None, max_length=255, examples=["Electronics & Home Appliances"])
    business_registration_number: Optional[str] = Field(None, max_length=100, examples=["CN-GZ-2024-8842"])


class ClientProfileResponse(BaseModel):
    """Client profile data returned in API responses."""

    company_name: str
    preferred_port: Optional[str] = None
    contact_number: Optional[str] = None

    model_config = {"from_attributes": True}


class SupplierProfileResponse(BaseModel):
    """Supplier profile data returned in API responses."""

    factory_name: str
    location_in_china: str
    specialty: Optional[str] = None
    business_registration_number: Optional[str] = None

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════════════════════
# Auth Schemas
# ═══════════════════════════════════════════════════════════

class UserCreate(BaseModel):
    """User registration request with profile fields."""

    email: EmailStr = Field(..., examples=["agent@example.com"])
    password: str = Field(..., min_length=8, max_length=128, examples=["secure_password"])
    full_name: str = Field(..., min_length=1, max_length=255, examples=["Ahmed Al-Masri"])
    phone: Optional[str] = Field(None, max_length=50, examples=["+962791234567"])
    role: str = Field(..., description="User role: client | agent | admin")

    # Client profile fields
    company_name: Optional[str] = Field(None, max_length=255, examples=["Acme Corp"])
    preferred_port: Optional[str] = Field(None, max_length=100, examples=["Aqaba"])
    contact_number: Optional[str] = Field(None, max_length=50, examples=["+962791234567"])

    # Supplier profile fields
    factory_name: Optional[str] = Field(None, max_length=255, examples=["Future Factory Ltd"])
    location_in_china: Optional[str] = Field(None, max_length=255, examples=["Guangzhou, Guangdong"])
    specialty: Optional[str] = Field(None, max_length=255, examples=["Electronics & Home Appliances"])
    business_registration_number: Optional[str] = Field(None, max_length=100, examples=["CN-GZ-2024-8842"])


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
    """Public user profile response with optional nested profile data."""

    id: UUID
    email: str
    full_name: str
    role: str
    phone: Optional[str] = None
    is_active: bool
    created_at: datetime
    profile: Optional[dict] = None  # Role-specific profile data (client or supplier)

    model_config = {"from_attributes": True}
