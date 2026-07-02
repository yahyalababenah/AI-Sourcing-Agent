"""Authentication request/response Pydantic schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator
from app.modules.auth.models import User, UserRole


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

    # ── New fields for Leaf 2 (Supplier Profile Expansion) ──
    business_license_url: Optional[str] = Field(
        None, max_length=500,
        examples=["https://storage.example.com/licenses/acme-license.pdf"],
    )
    """MinIO URL of the uploaded business license document."""
    factory_address: Optional[str] = Field(
        None, max_length=500,
        examples=["No. 188, Jinshan Road, Baiyun District, Guangzhou"],
    )
    """Detailed factory street address."""


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

    # ── New fields for Leaf 2 (Supplier Profile Expansion) ──
    business_license_url: Optional[str] = None
    factory_address: Optional[str] = None
    verification_status: str = "pending"
    """Verification status: pending / verified / rejected."""

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════════════════════
# Auth Schemas
# ═══════════════════════════════════════════════════════════

class UserCreate(BaseModel):
    """User registration request with profile fields."""

    email: EmailStr = Field(..., examples=["agent@example.com"])
    password: str = Field(..., min_length=8, max_length=128, examples=["Secure@123"])
    full_name: str = Field(..., min_length=1, max_length=255, examples=["Ahmed Al-Masri"])

    @field_validator("password")
    @classmethod
    def password_complexity(cls, v: str) -> str:
        errors = []
        if not any(c.isupper() for c in v):
            errors.append("at least one uppercase letter (A-Z)")
        if not any(c.islower() for c in v):
            errors.append("at least one lowercase letter (a-z)")
        if not any(c.isdigit() for c in v):
            errors.append("at least one digit (0-9)")
        if not any(c in r"!@#$%^&*()-_=+[]{}|;:',.<>?/`~" for c in v):
            errors.append("at least one special character (!@#$%^&* ...)")
        if errors:
            raise ValueError("Password must contain: " + ", ".join(errors))
        return v
    phone: Optional[str] = Field(None, max_length=50, examples=["+962791234567"])
    role: str = Field(
        ...,
        description="Self-registerable role: client | agent (admin accounts cannot be self-registered)",
    )

    # Client profile fields
    company_name: Optional[str] = Field(None, max_length=255, examples=["Acme Corp"])
    preferred_port: Optional[str] = Field(None, max_length=100, examples=["Aqaba"])
    contact_number: Optional[str] = Field(None, max_length=50, examples=["+962791234567"])

    # Supplier profile fields
    factory_name: Optional[str] = Field(None, max_length=255, examples=["Future Factory Ltd"])
    location_in_china: Optional[str] = Field(None, max_length=255, examples=["Guangzhou, Guangdong"])
    specialty: Optional[str] = Field(None, max_length=255, examples=["Electronics & Home Appliances"])
    business_registration_number: Optional[str] = Field(None, max_length=100, examples=["CN-GZ-2024-8842"])

    # ── New fields for Leaf 2 (Supplier Profile Expansion) ──
    business_license_url: Optional[str] = Field(
        None, max_length=500,
        examples=["https://storage.example.com/licenses/acme-license.pdf"],
    )
    factory_address: Optional[str] = Field(
        None, max_length=500,
        examples=["No. 188, Jinshan Road, Baiyun District, Guangzhou"],
    )


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


class UpdateProfileRequest(BaseModel):
    """Self-service profile update for any authenticated user."""

    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)

    # Client-specific
    company_name: Optional[str] = Field(None, max_length=255)
    preferred_port: Optional[str] = Field(None, max_length=100)
    contact_number: Optional[str] = Field(None, max_length=50)

    # Agent-specific
    factory_name: Optional[str] = Field(None, max_length=255)
    location_in_china: Optional[str] = Field(None, max_length=255)
    specialty: Optional[str] = Field(None, max_length=255)
    factory_address: Optional[str] = Field(None, max_length=500)


class UpdateVerificationRequest(BaseModel):
    """Admin request to update a supplier's verification status."""

    verification_status: str = Field(
        ...,
        description="New verification status: pending | verified | rejected",
        examples=["verified"],
    )
    rejection_reason: Optional[str] = Field(
        None,
        max_length=1000,
        examples=["Business license is expired or unclear"],
    )
    """Reason for rejection (required if status is 'rejected')."""


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


# ═══════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════


def build_user_response(user: User) -> UserResponse:
    """Build a UserResponse with the role-specific profile data attached.

    This function must be used instead of ``UserResponse.model_validate(user)``
    when the caller needs the nested ``profile`` dict populated.  Pydantic's
    ``model_validate`` does **not** automatically map ORM relationships (e.g.
    ``user.supplier_profile``) to a ``dict`` field like ``profile``.

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
