"""
AI-Sourcing Hub — Authentication API Tests

Tests all auth endpoints:
    - POST /api/v1/auth/register        (with role-specific profiles)
    - POST /api/v1/auth/login
    - GET  /api/v1/auth/me              (includes profile data)
    - POST /api/v1/auth/refresh
    - POST /api/v1/auth/logout

Covers all Phase 1 verification steps from the roadmap.
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import create_app
from app.shared.database import get_db
from app.shared.redis_client import get_redis_client


# ═══════════════════════════════════════════════════════════
# Fixtures
# ═══════════════════════════════════════════════════════════

@pytest.fixture
def app(db_session: AsyncSession):
    """Create app with test DB session override and mock Redis."""
    application = create_app()

    async def override_get_db():
        yield db_session

    async def override_get_redis():
        """Yield an AsyncMock Redis client to avoid needing a real Redis server."""
        mock_redis = AsyncMock()
        yield mock_redis

    application.dependency_overrides[get_db] = override_get_db
    application.dependency_overrides[get_redis_client] = override_get_redis
    return application


@pytest.fixture
async def client(app) -> AsyncClient:
    """Create async test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def registered_agent(client: AsyncClient, db_session: AsyncSession):
    """Register a test agent (supplier) and return credentials."""
    from tests.test_config import TEST_LEGACY_PASSWORD

    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "agent@test.com",
            "password": TEST_LEGACY_PASSWORD,
            "full_name": "Test Agent",
            "phone": "+962791234567",
            "role": "agent",
            "factory_name": "Test Factory Ltd",
            "location_in_china": "Guangzhou, Guangdong",
            "specialty": "Test Goods",
            "business_registration_number": "CN-TEST-001",
        },
    )
    assert response.status_code == 201
    return {
        "email": "agent@test.com",
        "password": TEST_LEGACY_PASSWORD,
    }


@pytest.fixture
async def registered_client(client: AsyncClient, db_session: AsyncSession):
    """Register a test client (buyer) and return credentials."""
    from tests.test_config import TEST_LEGACY_PASSWORD

    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "client@test.com",
            "password": TEST_LEGACY_PASSWORD,
            "full_name": "Test Client",
            "phone": "+962700000000",
            "role": "client",
            "company_name": "Test Corp",
            "preferred_port": "Aqaba",
            "contact_number": "+962700000000",
        },
    )
    assert response.status_code == 201
    return {
        "email": "client@test.com",
        "password": TEST_LEGACY_PASSWORD,
    }


# ═══════════════════════════════════════════════════════════
# Registration Tests
# ═══════════════════════════════════════════════════════════

class TestRegister:
    """POST /api/v1/auth/register"""

    # ── Success Cases ──

    async def test_register_agent_success(self, client: AsyncClient):
        """Should register an agent (supplier) and create SupplierProfile."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "newagent@test.com",
                "password": "securepass123",
                "full_name": "New Agent",
                "role": "agent",
                "factory_name": "Factory One",
                "location_in_china": "Shenzhen, Guangdong",
                "specialty": "Electronics",
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

        # Verify profile is present
        assert data["profile"] is not None
        assert data["profile"]["factory_name"] == "Factory One"
        assert data["profile"]["location_in_china"] == "Shenzhen, Guangdong"
        assert data["profile"]["specialty"] == "Electronics"
        assert data["profile"]["business_registration_number"] is None

    async def test_register_client_success(self, client: AsyncClient):
        """Should register a client (buyer) and create ClientProfile."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "newclient@test.com",
                "password": "securepass123",
                "full_name": "New Client",
                "role": "client",
                "company_name": "Client Corp",
                "preferred_port": "Aqaba",
                "contact_number": "+962700000001",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "newclient@test.com"
        assert data["full_name"] == "New Client"
        assert data["role"] == "client"
        assert data["is_active"] is True

        # Verify profile is present
        assert data["profile"] is not None
        assert data["profile"]["company_name"] == "Client Corp"
        assert data["profile"]["preferred_port"] == "Aqaba"
        assert data["profile"]["contact_number"] == "+962700000001"

    async def test_register_admin_rejected(self, client: AsyncClient):
        """Should reject self-registration as admin (TESTING_FINDINGS.md #0e).

        Admin accounts must never be creatable by an unauthenticated caller
        through the public registration endpoint — only client/agent are
        self-registerable roles.
        """
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "admin@test.com",
                "password": "Secure@123",
                "full_name": "Admin User",
                "role": "admin",
            },
        )
        assert response.status_code == 422
        assert "admin" not in response.json()["error"]["details"]["valid_roles"]

    # ── Validation Cases ──

    async def test_register_missing_role(self, client: AsyncClient):
        """Should reject registration without a role."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "norole@test.com",
                "password": "securepass123",
                "full_name": "No Role",
            },
        )
        assert response.status_code == 422

    async def test_register_invalid_role(self, client: AsyncClient):
        """Should reject registration with an invalid role."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "badrole@test.com",
                "password": "securepass123",
                "full_name": "Bad Role",
                "role": "superadmin",
            },
        )
        assert response.status_code == 422

    async def test_register_client_missing_company_name(self, client: AsyncClient):
        """Should reject client registration without company_name."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "client_no_company@test.com",
                "password": "securepass123",
                "full_name": "No Company",
                "role": "client",
            },
        )
        assert response.status_code == 422

    async def test_register_agent_missing_factory_name(self, client: AsyncClient):
        """Should reject agent registration without factory_name."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "agent_no_factory@test.com",
                "password": "securepass123",
                "full_name": "No Factory",
                "role": "agent",
                "location_in_china": "Somewhere",
            },
        )
        assert response.status_code == 422

    async def test_register_agent_missing_location(self, client: AsyncClient):
        """Should reject agent registration without location_in_china."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "agent_no_loc@test.com",
                "password": "securepass123",
                "full_name": "No Location",
                "role": "agent",
                "factory_name": "Factory",
            },
        )
        assert response.status_code == 422

    async def test_register_duplicate_email(self, client: AsyncClient, registered_agent: dict):
        """Should reject registration with existing email."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": registered_agent["email"],
                "password": "anotherpass123",
                "full_name": "Duplicate Agent",
                "role": "agent",
                "factory_name": "Dup Factory",
                "location_in_china": "Dup Location",
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
                "role": "agent",
                "factory_name": "Factory",
                "location_in_china": "Location",
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
                "role": "agent",
                "factory_name": "Factory",
                "location_in_china": "Location",
            },
        )
        assert response.status_code == 422


# ═══════════════════════════════════════════════════════════
# Login Tests
# ═══════════════════════════════════════════════════════════

class TestLogin:
    """POST /api/v1/auth/login"""

    async def test_login_success(self, client: AsyncClient, registered_agent: dict):
        """Should authenticate and return JWT token pair."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": registered_agent["email"],
                "password": registered_agent["password"],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["expires_in"] > 0

    async def test_login_invalid_password(self, client: AsyncClient, registered_agent: dict):
        """Should return 401 for wrong password."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": registered_agent["email"],
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

    async def test_get_me_agent_with_profile(self, client: AsyncClient, registered_agent: dict):
        """Should return agent profile with SupplierProfile data."""
        # Login first
        login_resp = await client.post(
            "/api/v1/auth/login",
            json=registered_agent,
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
        assert data["email"] == registered_agent["email"]
        assert data["role"] == "agent"
        assert data["is_active"] is True
        # Verify profile data
        assert data["profile"] is not None
        assert data["profile"]["factory_name"] == "Test Factory Ltd"
        assert data["profile"]["location_in_china"] == "Guangzhou, Guangdong"
        assert data["profile"]["specialty"] == "Test Goods"
        assert data["profile"]["business_registration_number"] == "CN-TEST-001"

    async def test_get_me_client_with_profile(self, client: AsyncClient, registered_client: dict):
        """Should return client profile with ClientProfile data."""
        login_resp = await client.post(
            "/api/v1/auth/login",
            json=registered_client,
        )
        tokens = login_resp.json()
        access_token = tokens["access_token"]

        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == registered_client["email"]
        assert data["role"] == "client"
        # Verify profile data
        assert data["profile"] is not None
        assert data["profile"]["company_name"] == "Test Corp"
        assert data["profile"]["preferred_port"] == "Aqaba"
        assert data["profile"]["contact_number"] == "+962700000000"

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

    async def test_get_me_defaults_onboarding_status_pending(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        """New users should default to onboarding_status=pending with no completion timestamp."""
        from app.modules.auth.models import ClientProfile, User, UserRole
        from app.modules.auth.service import _hash_password, create_tokens

        user = User(
            email="onboard-default@test.com",
            password_hash=_hash_password("Secure@Pass123"),
            full_name="Onboard Default",
            role=UserRole.CLIENT,
        )
        db_session.add(user)
        await db_session.flush()
        db_session.add(ClientProfile(user_id=user.id, company_name="Onboard Co"))
        await db_session.commit()

        tokens = await create_tokens(user)
        response = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["onboarding_status"] == "pending"
        assert data["onboarding_completed_at"] is None

    async def test_patch_me_updates_onboarding_status(
        self, client: AsyncClient, db_session: AsyncSession
    ):
        """PATCH /auth/me should persist onboarding_status and stamp onboarding_completed_at on completion."""
        from app.modules.auth.models import ClientProfile, User, UserRole
        from app.modules.auth.service import _hash_password, create_tokens

        user = User(
            email="onboard-patch@test.com",
            password_hash=_hash_password("Secure@Pass123"),
            full_name="Onboard Patch",
            role=UserRole.CLIENT,
        )
        db_session.add(user)
        await db_session.flush()
        db_session.add(ClientProfile(user_id=user.id, company_name="Onboard Co"))
        await db_session.commit()

        tokens = await create_tokens(user)
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        snoozed_resp = await client.patch(
            "/api/v1/auth/me",
            json={"onboarding_status": "snoozed"},
            headers=headers,
        )
        assert snoozed_resp.status_code == 200
        assert snoozed_resp.json()["onboarding_status"] == "snoozed"
        assert snoozed_resp.json()["onboarding_completed_at"] is None

        completed_resp = await client.patch(
            "/api/v1/auth/me",
            json={"onboarding_status": "completed"},
            headers=headers,
        )
        assert completed_resp.status_code == 200
        assert completed_resp.json()["onboarding_status"] == "completed"
        assert completed_resp.json()["onboarding_completed_at"] is not None


class TestRefreshToken:
    """POST /api/v1/auth/refresh"""

    async def test_refresh_success(self, client: AsyncClient, registered_agent: dict):
        """Should return new access token with valid refresh token."""
        # Login
        login_resp = await client.post(
            "/api/v1/auth/login",
            json=registered_agent,
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

    async def test_logout_success(self, client: AsyncClient, registered_agent: dict):
        """Should successfully logout and blacklist refresh token."""
        # Login
        login_resp = await client.post(
            "/api/v1/auth/login",
            json=registered_agent,
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
