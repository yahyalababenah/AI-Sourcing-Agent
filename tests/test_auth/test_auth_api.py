"""
AI-Sourcing Hub — Authentication API Tests

Tests all auth endpoints:
    - POST /api/v1/auth/register
    - POST /api/v1/auth/login
    - GET  /api/v1/auth/me
    - POST /api/v1/auth/refresh
    - POST /api/v1/auth/logout

Covers all Phase 1 verification steps from the roadmap.
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import create_app
from app.shared.database import get_db


# ═══════════════════════════════════════════════════════════
# Fixtures
# ═══════════════════════════════════════════════════════════

@pytest.fixture
def app(db_session: AsyncSession):
    """Create app with test DB session override."""
    application = create_app()

    async def override_get_db():
        yield db_session

    application.dependency_overrides[get_db] = override_get_db
    return application


@pytest.fixture
async def client(app) -> AsyncClient:
    """Create async test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def registered_user(client: AsyncClient, db_session: AsyncSession):
    """Register a test user and return credentials."""
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "agent@test.com",
            "password": "test_password_123",
            "full_name": "Test Agent",
            "phone": "+962791234567",
        },
    )
    assert response.status_code == 201
    return {
        "email": "agent@test.com",
        "password": "test_password_123",
    }


# ═══════════════════════════════════════════════════════════
# Registration Tests
# ═══════════════════════════════════════════════════════════

class TestRegister:
    """POST /api/v1/auth/register"""

    async def test_register_success(self, client: AsyncClient):
        """Should create user and return 201 with user profile."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "newagent@test.com",
                "password": "securepass123",
                "full_name": "New Agent",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "newagent@test.com"
        assert data["full_name"] == "New Agent"
        assert data["role"] == "agent"
        assert data["is_active"] is True
        assert "id" in data
        assert "password" not in data  # Password should never be returned

    async def test_register_duplicate_email(self, client: AsyncClient, registered_user: dict):
        """Should reject registration with existing email."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": registered_user["email"],
                "password": "anotherpass123",
                "full_name": "Duplicate Agent",
            },
        )
        assert response.status_code == 422
        data = response.json()
        assert data["error"]["code"] == "VALIDATION_ERROR"

    async def test_register_invalid_email(self, client: AsyncClient):
        """Should reject invalid email format."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "not-an-email",
                "password": "securepass123",
                "full_name": "Bad Email",
            },
        )
        assert response.status_code == 422

    async def test_register_short_password(self, client: AsyncClient):
        """Should reject passwords shorter than 8 characters."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "shortpw@test.com",
                "password": "short",
                "full_name": "Short Password",
            },
        )
        assert response.status_code == 422


# ═══════════════════════════════════════════════════════════
# Login Tests
# ═══════════════════════════════════════════════════════════

class TestLogin:
    """POST /api/v1/auth/login"""

    async def test_login_success(self, client: AsyncClient, registered_user: dict):
        """Should authenticate and return JWT token pair."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": registered_user["email"],
                "password": registered_user["password"],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] > 0

    async def test_login_invalid_password(self, client: AsyncClient, registered_user: dict):
        """Should return 401 for wrong password."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": registered_user["email"],
                "password": "wrong_password_xyz",
            },
        )
        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == "AUTH_INVALID"

    async def test_login_nonexistent_user(self, client: AsyncClient):
        """Should return 401 for non-existent user."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "nobody@test.com",
                "password": "somepassword123",
            },
        )
        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == "AUTH_INVALID"


# ═══════════════════════════════════════════════════════════
# Token & Profile Tests
# ═══════════════════════════════════════════════════════════

class TestGetMe:
    """GET /api/v1/auth/me"""

    async def test_get_me_with_valid_token(self, client: AsyncClient, registered_user: dict):
        """Should return user profile with valid access token."""
        # Login first
        login_resp = await client.post(
            "/api/v1/auth/login",
            json=registered_user,
        )
        tokens = login_resp.json()
        access_token = tokens["access_token"]

        # Get profile
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == registered_user["email"]
        assert data["role"] == "agent"
        assert data["is_active"] is True

    async def test_get_me_no_token(self, client: AsyncClient):
        """Should return 401 without Authorization header."""
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 401

    async def test_get_me_expired_token(self, client: AsyncClient):
        """Should return 401 with garbage token."""
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer definitely_not_a_valid_jwt_token"},
        )
        assert response.status_code == 401


class TestRefreshToken:
    """POST /api/v1/auth/refresh"""

    async def test_refresh_success(self, client: AsyncClient, registered_user: dict):
        """Should return new access token with valid refresh token."""
        # Login
        login_resp = await client.post(
            "/api/v1/auth/login",
            json=registered_user,
        )
        tokens = login_resp.json()
        refresh_token = tokens["refresh_token"]

        # Refresh
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_refresh_with_invalid_token(self, client: AsyncClient):
        """Should return 401 with invalid refresh token."""
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "garbage_invalid_token"},
        )
        assert response.status_code == 401


class TestLogout:
    """POST /api/v1/auth/logout"""

    async def test_logout_success(self, client: AsyncClient, registered_user: dict):
        """Should successfully logout and blacklist refresh token."""
        # Login
        login_resp = await client.post(
            "/api/v1/auth/login",
            json=registered_user,
        )
        tokens = login_resp.json()
        access_token = tokens["access_token"]
        refresh_token = tokens["refresh_token"]

        # Logout
        response = await client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": refresh_token},
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert response.status_code == 204

    async def test_logout_requires_auth(self, client: AsyncClient):
        """Should return 401 without authentication."""
        response = await client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": "some_token"},
        )
        assert response.status_code == 401
