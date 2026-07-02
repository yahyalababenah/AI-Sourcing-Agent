"""
AI-Sourcing Hub — RBAC Boundary Matrix

For each sensitive endpoint, verifies every unauthorized role gets 401/403.
Role-check dependencies (``require_admin`` / ``require_agent_or_admin`` /
``require_agent``) run before the route handler body, so a nonexistent
UUID in the path is safe to use for the *wrong-role* cases — the request
never reaches the "does this resource exist" logic. One representative
success case per access tier is included so the matrix isn't just asserting
403 in a vacuum.
"""
import uuid

import pytest

from app.modules.auth.service import _create_access_token

FAKE_ID = str(uuid.uuid4())


def _headers(user) -> dict:
    return {"Authorization": f"Bearer {_create_access_token(str(user.id))}"}


# (method, path, allowed_roles, json_body)
ADMIN_ONLY_ENDPOINTS = [
    ("get", "/api/v1/admin/ai-costs", None),
    ("get", "/api/v1/admin/stats", None),
    ("get", "/api/v1/admin/users", None),
    ("put", f"/api/v1/admin/users/{FAKE_ID}/status", {"is_active": False}),
    ("put", f"/api/v1/admin/users/{FAKE_ID}/verification", {"verification_status": "verified"}),
    ("post", "/api/v1/pricing/rules", {
        "name": "x", "category": "freight", "rule_type": "fixed", "value": 1.0,
    }),
    ("put", f"/api/v1/pricing/rules/{FAKE_ID}", {"value": 2.0}),
    ("delete", f"/api/v1/pricing/rules/{FAKE_ID}", None),
    ("post", "/api/v1/pricing/hs-codes", {
        "hs_code": "00000000000", "duty_rate_001": 5, "service_flat_fee_301": 0,
        "service_percent_070": 0, "requires_license": False, "penalty_rate_018": 0,
    }),
    ("put", f"/api/v1/pricing/hs-codes/{FAKE_ID}", {"duty_rate_001": 6}),
    ("delete", f"/api/v1/pricing/hs-codes/{FAKE_ID}", None),
    ("post", "/api/v1/pricing/exchange-rates/refresh", None),
]

AGENT_OR_ADMIN_ENDPOINTS = [
    ("post", "/api/v1/intake/translate", {"raw_text": "test"}),
    ("post", f"/api/v1/intake/rfqs/{FAKE_ID}/match", None),
    ("get", "/api/v1/catalog/products/pending", None),
    ("patch", f"/api/v1/catalog/products/{FAKE_ID}/review", {"action": "approve"}),
    ("post", "/api/v1/quotes/generate", {"rfq_id": FAKE_ID}),
    ("put", f"/api/v1/quotes/{FAKE_ID}/status", {"status": "sent"}),
    ("post", f"/api/v1/quotes/{FAKE_ID}/finalize", None),
]

AGENT_ONLY_ENDPOINTS = [
    ("get", "/api/v1/intake/rfqs/matched", None),
]


@pytest.mark.asyncio
class TestAdminOnlyEndpoints:
    @pytest.mark.parametrize("method,path,body", ADMIN_ONLY_ENDPOINTS)
    async def test_client_role_forbidden(self, client, make_user, method, path, body):
        user = await make_user(role="client")
        resp = await client.request(method.upper(), path, json=body, headers=_headers(user))
        assert resp.status_code == 403, f"{method.upper()} {path} should 403 for client"

    @pytest.mark.parametrize("method,path,body", ADMIN_ONLY_ENDPOINTS)
    async def test_agent_role_forbidden(self, client, make_user, method, path, body):
        user = await make_user(role="agent")
        resp = await client.request(method.upper(), path, json=body, headers=_headers(user))
        assert resp.status_code == 403, f"{method.upper()} {path} should 403 for agent"

    @pytest.mark.parametrize("method,path,body", ADMIN_ONLY_ENDPOINTS)
    async def test_unauthenticated_rejected(self, client, method, path, body):
        resp = await client.request(method.upper(), path, json=body)
        assert resp.status_code == 401, f"{method.upper()} {path} should 401 unauthenticated"

    async def test_admin_can_access_representative_endpoint(self, client, make_user):
        # Uses /admin/users (plain ORM query), not /admin/stats — the latter's
        # raw SQL uses PostgreSQL-only jsonb_array_length/json_object_agg/::text
        # cast and can't run on SQLite; see TESTING_FINDINGS.md.
        admin = await make_user(role="admin")
        resp = await client.get("/api/v1/admin/users", headers=_headers(admin))
        assert resp.status_code == 200


@pytest.mark.asyncio
class TestAgentOrAdminEndpoints:
    @pytest.mark.parametrize("method,path,body", AGENT_OR_ADMIN_ENDPOINTS)
    async def test_client_role_forbidden(self, client, make_user, method, path, body):
        user = await make_user(role="client")
        resp = await client.request(method.upper(), path, json=body, headers=_headers(user))
        assert resp.status_code == 403, f"{method.upper()} {path} should 403 for client"

    @pytest.mark.parametrize("method,path,body", AGENT_OR_ADMIN_ENDPOINTS)
    async def test_unauthenticated_rejected(self, client, method, path, body):
        resp = await client.request(method.upper(), path, json=body)
        assert resp.status_code == 401, f"{method.upper()} {path} should 401 unauthenticated"

    async def test_agent_can_access_representative_endpoint(self, client, make_user):
        agent = await make_user(role="agent")
        resp = await client.get("/api/v1/catalog/products/pending", headers=_headers(agent))
        assert resp.status_code == 200


@pytest.mark.asyncio
class TestAgentOnlyEndpoints:
    @pytest.mark.parametrize("method,path,body", AGENT_ONLY_ENDPOINTS)
    async def test_client_role_forbidden(self, client, make_user, method, path, body):
        user = await make_user(role="client")
        resp = await client.request(method.upper(), path, json=body, headers=_headers(user))
        assert resp.status_code == 403

    @pytest.mark.parametrize("method,path,body", AGENT_ONLY_ENDPOINTS)
    async def test_admin_forbidden_where_agent_only(self, client, make_user, method, path, body):
        """Some suppliers-only inboxes (e.g. the exclusive match list) are
        scoped to the agent role specifically, not agent_or_admin."""
        user = await make_user(role="admin")
        resp = await client.request(method.upper(), path, json=body, headers=_headers(user))
        assert resp.status_code == 403

    async def test_agent_can_access_representative_endpoint(self, client, make_user):
        agent = await make_user(role="agent")
        resp = await client.get("/api/v1/intake/rfqs/matched", headers=_headers(agent))
        assert resp.status_code == 200


@pytest.mark.asyncio
class TestRegistrationRoleEscalation:
    """TESTING_FINDINGS.md #0e: an unauthenticated caller must never be able
    to self-register as admin (privilege escalation via POST /auth/register).
    """

    async def test_unauthenticated_admin_self_registration_rejected(self, client):
        resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "escalation-attempt@example.com",
                "password": "SecurePass123!",
                "full_name": "Attacker",
                "role": "admin",
            },
        )
        assert resp.status_code in (400, 403, 422), (
            "self-registration with role=admin must be rejected, not accepted"
        )
        body = resp.json()
        assert "admin" not in body["error"]["details"]["valid_roles"]

    @pytest.mark.parametrize("role", ["client", "agent"])
    async def test_legitimate_self_registerable_roles_still_work(self, client, role):
        extra_fields = (
            {"company_name": "Test Co."}
            if role == "client"
            else {"factory_name": "Test Factory", "location_in_china": "Shenzhen"}
        )
        resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": f"legit-{role}@example.com",
                "password": "SecurePass123!",
                "full_name": "Legit User",
                "role": role,
                **extra_fields,
            },
        )
        assert resp.status_code == 201
        assert resp.json()["role"] == role
