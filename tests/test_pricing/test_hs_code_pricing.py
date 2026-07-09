"""
AI-Sourcing Hub — HS-Code Fee Schedule Tests

Covers:
  - Engine: multi-item HS-Code fee calculation (001/301/070/018) and the
    fallback path when no HS code / schedule entry is found
  - API: HS-Code fee schedule CRUD (/api/v1/pricing/hs-codes)
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
from typing import AsyncGenerator

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.pricing.engine import PricingEngine, LineItemInput
from app.shared.database import get_db
from app.shared.redis_client import get_redis_client


# ═══════════════════════════════════════════════════════════
# Reference HS-Code entry (matches the verified JCAP simulation values)
# ═══════════════════════════════════════════════════════════

VERIFIED_HS_ENTRY = {
    "duty_rate_001": 10,
    "service_flat_fee_301": 50,
    "service_percent_070": 5,
    "requires_license": True,
    "penalty_rate_018": 2.5,
}


# ═══════════════════════════════════════════════════════════
# ── Engine Unit Tests ──
# ═══════════════════════════════════════════════════════════

class TestHSCodeLandedCost:
    """Unit tests for HS-Code driven fee calculation in ``calculate_landed_cost``."""

    def setup_method(self):
        self.engine = PricingEngine()

    def test_001_duty_uses_hs_entry_rate_on_cif(self):
        """001 duty rate comes from the HS entry, applied on CIF."""
        result = self.engine.calculate_landed_cost(
            price_rmb=100.0, weight_kg=500.0, quantity=100,
            destination_port="Aqaba", currency="JOD",
            hs_entry=VERIFIED_HS_ENTRY, has_license=True,
        )
        expected_customs = result["cif_per_unit"] * 0.10
        assert result["customs_per_unit"] == pytest.approx(expected_customs, rel=0.01)
        assert result["hs_code_matched"] is True

    def test_070_service_percent_on_cif(self):
        """070 service fee is 5% of CIF."""
        result = self.engine.calculate_landed_cost(
            price_rmb=100.0, weight_kg=500.0, quantity=100,
            destination_port="Aqaba", currency="JOD",
            hs_entry=VERIFIED_HS_ENTRY, has_license=True,
        )
        expected = result["cif_per_unit"] * 0.05
        assert result["service_percent_per_unit"] == pytest.approx(expected, rel=0.01)

    def test_301_flat_fee_is_shipment_level_not_divided(self):
        """301 (50 JOD) is a per-declaration fee — the full amount is reported
        per line by calculate_landed_cost; PricingEngine.calculate() then
        charges it once per shipment (max across lines), not per unit/line.
        """
        result = self.engine.calculate_landed_cost(
            price_rmb=100.0, weight_kg=500.0, quantity=100,
            destination_port="Aqaba", currency="JOD",
            hs_entry=VERIFIED_HS_ENTRY, has_license=True,
        )
        assert result["service_flat_301_line"] == pytest.approx(50.0, rel=0.01)

    def test_018_penalty_not_applied_when_license_confirmed(self):
        """018 penalty is 0 when has_license=True even though requires_license=True."""
        result = self.engine.calculate_landed_cost(
            price_rmb=100.0, weight_kg=500.0, quantity=100,
            destination_port="Aqaba", currency="JOD",
            hs_entry=VERIFIED_HS_ENTRY, has_license=True,
        )
        assert result["penalty_per_unit"] == 0.0

    def test_018_penalty_applied_when_license_not_confirmed(self):
        """018 penalty (2.5% of CIF) applies when requires_license=True and has_license=False."""
        result = self.engine.calculate_landed_cost(
            price_rmb=100.0, weight_kg=500.0, quantity=100,
            destination_port="Aqaba", currency="JOD",
            hs_entry=VERIFIED_HS_ENTRY, has_license=False,
        )
        expected_penalty = result["cif_per_unit"] * 0.025
        assert result["penalty_per_unit"] == pytest.approx(expected_penalty, abs=0.01)
        assert any("penalty_018" in r for r in result["rules_applied"])

    def test_no_penalty_when_license_not_required(self):
        """No 018 penalty at all if the HS entry doesn't require a license."""
        entry = {**VERIFIED_HS_ENTRY, "requires_license": False}
        result = self.engine.calculate_landed_cost(
            price_rmb=100.0, weight_kg=500.0, quantity=100,
            destination_port="Aqaba", currency="JOD",
            hs_entry=entry, has_license=False,
        )
        assert result["penalty_per_unit"] == 0.0

    def test_fallback_when_hs_entry_none(self):
        """No hs_entry → hs_code_matched False, general customs rate used, warning present."""
        result = self.engine.calculate_landed_cost(
            price_rmb=100.0, weight_kg=500.0, quantity=100,
            destination_port="Aqaba", currency="JOD",
        )
        assert result["hs_code_matched"] is False
        assert result["service_flat_301_line"] == 0.0
        assert result["service_percent_per_unit"] == 0.0
        assert result["penalty_per_unit"] == 0.0
        assert "hs_code_not_found:fallback_to_general_rate" in result["rules_applied"]
        # Fallback still uses CIF as the duty base (post-CIF-fix behavior)
        expected_customs = result["cif_per_unit"] * 0.05
        assert result["customs_per_unit"] == pytest.approx(expected_customs, rel=0.01)


class TestHSCodeCalculate:
    """Unit tests for HS-Code fees inside ``PricingEngine.calculate()`` (multi-item)."""

    def setup_method(self):
        self.engine = PricingEngine()


    def test_vat_base_includes_070_301_018_by_default(self):
        """Default behavior: vat_base_includes_fees=1 widens the VAT base to
        include the 070/301/018 fees, so VAT here must exceed the CIF+001-only
        calculation from the toggle-off test above.
        """
        products = [
            LineItemInput(
                product_id="p1", product_name="Lamp", quantity=100,
                unit_price_cny=100.0, weight_kg=500.0,
                hs_entry=VERIFIED_HS_ENTRY, has_license=False,
            )
        ]
        result = self.engine.calculate(
            rfq_id="hs-vat-test-default", target_currency="JOD",
            destination_port="Aqaba", products=products,
        )
        li = result["line_items"][0]
        narrow_vat_base = li["cif_value"] + li["customs_duty"]
        narrow_vat = round(narrow_vat_base * 0.16, 2)
        assert result["vat"] > narrow_vat

    def test_line_item_result_fields_present(self):
        """LineItemResult exposes service_percent_070, penalty_018, hs_code_matched;
        service_flat_301 stays 0 per line since 301 is now a shipment-level fee
        surfaced via the top-level service_flat_fee_301_total instead.
        """
        products = [
            LineItemInput(
                product_id="p1", product_name="Lamp", quantity=10,
                unit_price_cny=100.0, weight_kg=50.0,
                hs_entry=VERIFIED_HS_ENTRY, has_license=True,
            )
        ]
        result = self.engine.calculate(
            rfq_id="hs-fields-test", target_currency="JOD",
            destination_port="Aqaba", products=products,
        )
        li = result["line_items"][0]
        assert li["hs_code_matched"] is True
        assert li["penalty_018"] == 0.0  # license confirmed
        assert li["service_flat_301"] == 0.0
        assert result["service_flat_fee_301_total"] > 0
        assert li["service_percent_070"] > 0

    def test_fallback_product_has_no_hs_fields(self):
        """Product without hs_entry gets hs_code_matched=False and zeroed HS fields."""
        products = [
            LineItemInput(
                product_id="p1", product_name="Lamp", quantity=10,
                unit_price_cny=100.0, weight_kg=50.0,
            )
        ]
        result = self.engine.calculate(
            rfq_id="hs-fallback-test", target_currency="JOD",
            destination_port="Aqaba", products=products,
        )
        li = result["line_items"][0]
        assert li["hs_code_matched"] is False
        assert li["service_flat_301"] == 0.0
        assert li["service_percent_070"] == 0.0
        assert li["penalty_018"] == 0.0


# ═══════════════════════════════════════════════════════════
# ── API Integration Tests ──
# ═══════════════════════════════════════════════════════════

@pytest.fixture
def app(db_session: AsyncSession):
    """Override the conftest app to inject DB session and mock Redis."""
    from unittest.mock import AsyncMock

    from app.main import create_app

    application = create_app()

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    async def override_get_redis():
        mock_redis = AsyncMock()
        mock_redis.delete.return_value = 1
        yield mock_redis

    application.dependency_overrides[get_db] = override_get_db
    application.dependency_overrides[get_redis_client] = override_get_redis
    return application


@pytest.fixture
async def client(app) -> AsyncClient:
    """FastAPI test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def auth_headers(client: AsyncClient, db_session: AsyncSession) -> dict:
    """Register an agent (supplier) and return auth headers."""
    from app.modules.auth.models import UserRole

    register_payload = {
        "email": "hs_code_test@example.com",
        "password": "TestPass123!",
        "full_name": "HS Code Test User",
        "role": UserRole.AGENT.value,
        "factory_name": "HS Code Test Factory",
        "location_in_china": "Guangzhou, Guangdong",
    }
    resp = await client.post("/api/v1/auth/register", json=register_payload)
    assert resp.status_code == 201
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": register_payload["email"],
        "password": register_payload["password"],
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def admin_headers(client: AsyncClient, db_session: AsyncSession) -> dict:
    """Create an admin user directly in the DB and return auth headers.

    Admin accounts can't be self-registered via /auth/register (see
    TESTING_FINDINGS.md #0e) — matches the direct-insert pattern used by
    the top-level ``admin_headers`` fixture in tests/conftest.py.
    """
    import uuid
    from app.modules.auth.models import User, UserRole
    from app.modules.auth.service import _hash_password

    email = "hs_code_admin@example.com"
    password = "AdminPass123!"
    admin = User(
        id=uuid.uuid4(),
        email=email,
        password_hash=_hash_password(password),
        full_name="HS Code Admin",
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(admin)
    await db_session.flush()

    login_resp = await client.post("/api/v1/auth/login", json={
        "email": email,
        "password": password,
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


HS_CODE_PAYLOAD = {
    "hs_code": "85241210000",
    "description": "Verified reference HS code",
    "duty_rate_001": 10,
    "service_flat_fee_301": 50,
    "service_percent_070": 5,
    "requires_license": True,
    "penalty_rate_018": 2.5,
    "is_verified": True,
    "source_note": "JCAP simulation",
}


class TestHSCodeScheduleAPI:
    """CRUD tests for /api/v1/pricing/hs-codes."""

    @pytest.mark.asyncio
    async def test_list_empty(self, client: AsyncClient, auth_headers: dict):
        """GET /hs-codes returns empty list when no entries exist."""
        resp = await client.get("/api/v1/pricing/hs-codes", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["items"] == []

    @pytest.mark.asyncio
    async def test_create_requires_admin(self, client: AsyncClient, auth_headers: dict):
        """Non-admin cannot create HS-Code schedules (403)."""
        resp = await client.post(
            "/api/v1/pricing/hs-codes", headers=auth_headers, json=HS_CODE_PAYLOAD,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_create_and_get(self, client: AsyncClient, admin_headers: dict, auth_headers: dict):
        """POST /hs-codes creates an entry, then GET /hs-codes lists it."""
        resp = await client.post(
            "/api/v1/pricing/hs-codes", headers=admin_headers, json=HS_CODE_PAYLOAD,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["hs_code"] == "85241210000"
        assert data["duty_rate_001"] == 10
        assert data["is_verified"] is True

        list_resp = await client.get("/api/v1/pricing/hs-codes", headers=auth_headers)
        assert list_resp.status_code == 200
        assert list_resp.json()["total"] == 1

    @pytest.mark.asyncio
    async def test_update_requires_admin(self, client: AsyncClient, admin_headers: dict, auth_headers: dict):
        """PUT /hs-codes/{code} is admin-only; non-admin gets 403."""
        await client.post("/api/v1/pricing/hs-codes", headers=admin_headers, json=HS_CODE_PAYLOAD)
        resp = await client.put(
            f"/api/v1/pricing/hs-codes/{HS_CODE_PAYLOAD['hs_code']}",
            headers=auth_headers,
            json={**HS_CODE_PAYLOAD, "duty_rate_001": 12},
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_update_as_admin(self, client: AsyncClient, admin_headers: dict):
        """PUT /hs-codes/{code} updates fields (admin only)."""
        await client.post("/api/v1/pricing/hs-codes", headers=admin_headers, json=HS_CODE_PAYLOAD)
        resp = await client.put(
            f"/api/v1/pricing/hs-codes/{HS_CODE_PAYLOAD['hs_code']}",
            headers=admin_headers,
            json={**HS_CODE_PAYLOAD, "duty_rate_001": 12},
        )
        assert resp.status_code == 200
        assert resp.json()["duty_rate_001"] == 12

    @pytest.mark.asyncio
    async def test_delete_requires_admin(self, client: AsyncClient, admin_headers: dict, auth_headers: dict):
        """DELETE /hs-codes/{code} is admin-only; non-admin gets 403."""
        await client.post("/api/v1/pricing/hs-codes", headers=admin_headers, json=HS_CODE_PAYLOAD)
        resp = await client.delete(
            f"/api/v1/pricing/hs-codes/{HS_CODE_PAYLOAD['hs_code']}", headers=auth_headers,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_as_admin(self, client: AsyncClient, admin_headers: dict):
        """DELETE /hs-codes/{code} removes the entry (admin only)."""
        await client.post("/api/v1/pricing/hs-codes", headers=admin_headers, json=HS_CODE_PAYLOAD)
        resp = await client.delete(
            f"/api/v1/pricing/hs-codes/{HS_CODE_PAYLOAD['hs_code']}", headers=admin_headers,
        )
        assert resp.status_code == 204

        list_resp = await client.get("/api/v1/pricing/hs-codes", headers=admin_headers)
        assert list_resp.json()["total"] == 0

    @pytest.mark.asyncio
    async def test_create_duplicate_hs_code_returns_clean_error(
        self, client: AsyncClient, admin_headers: dict,
    ):
        """REGRESSION: POSTing an already-existing hs_code must return a clean
        validation error, not an unhandled IntegrityError -> 500.
        """
        first = await client.post("/api/v1/pricing/hs-codes", headers=admin_headers, json=HS_CODE_PAYLOAD)
        assert first.status_code == 201

        second = await client.post("/api/v1/pricing/hs-codes", headers=admin_headers, json=HS_CODE_PAYLOAD)
        assert second.status_code == 422
        assert second.status_code != 500

        list_resp = await client.get("/api/v1/pricing/hs-codes", headers=admin_headers)
        assert list_resp.json()["total"] == 1

    @pytest.mark.asyncio
    async def test_update_cannot_change_hs_code(self, client: AsyncClient, admin_headers: dict):
        """REGRESSION: PUT /hs-codes/{code} must not let the request body rename
        the resource's identifying hs_code, even though the frontend disables
        that field client-side (a direct API call could bypass it).
        """
        await client.post("/api/v1/pricing/hs-codes", headers=admin_headers, json=HS_CODE_PAYLOAD)

        resp = await client.put(
            f"/api/v1/pricing/hs-codes/{HS_CODE_PAYLOAD['hs_code']}",
            headers=admin_headers,
            json={**HS_CODE_PAYLOAD, "hs_code": "99999999999", "duty_rate_001": 20},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["hs_code"] == HS_CODE_PAYLOAD["hs_code"]
        assert data["duty_rate_001"] == 20

        list_resp = await client.get("/api/v1/pricing/hs-codes", headers=admin_headers)
        codes = [item["hs_code"] for item in list_resp.json()["items"]]
        assert codes == [HS_CODE_PAYLOAD["hs_code"]]
        assert "99999999999" not in codes


class TestCalculateWithHSCode:
    """Integration tests for POST /api/v1/pricing/calculate with hs_code."""

    @pytest.mark.asyncio
    async def test_calculate_with_matched_hs_code(self, client: AsyncClient, admin_headers: dict, auth_headers: dict):
        """A product with a matched hs_code gets 001/301/070 populated and 018 if unlicensed."""
        await client.post("/api/v1/pricing/hs-codes", headers=admin_headers, json=HS_CODE_PAYLOAD)

        resp = await client.post(
            "/api/v1/pricing/calculate",
            headers=auth_headers,
            json={
                "rfq_id": "hs-calc-test",
                "target_currency": "JOD",
                "destination_port": "Aqaba",
                "products": [
                    {
                        "product_id": "prod-1",
                        "name": "Test Lamp",
                        "quantity": 100,
                        "unit_price_cny": 50.0,
                        "weight_kg": 500.0,
                        "hs_code": "85241210000",
                        "has_license": False,
                    }
                ],
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        li = body["line_items"][0]
        assert li["hs_code_matched"] is True
        assert body["service_flat_fee_301_total"] > 0
        assert li["service_percent_070"] > 0
        assert li["penalty_018"] > 0

    @pytest.mark.asyncio
    async def test_calculate_unmatched_hs_code_falls_back(self, client: AsyncClient, auth_headers: dict):
        """A product with an hs_code not present in the DB falls back to the general rate."""
        resp = await client.post(
            "/api/v1/pricing/calculate",
            headers=auth_headers,
            json={
                "rfq_id": "hs-calc-fallback",
                "target_currency": "JOD",
                "destination_port": "Aqaba",
                "products": [
                    {
                        "product_id": "prod-1",
                        "name": "Test Lamp",
                        "quantity": 100,
                        "unit_price_cny": 50.0,
                        "weight_kg": 500.0,
                        "hs_code": "00000000000",
                    }
                ],
            },
        )
        assert resp.status_code == 200
        li = resp.json()["line_items"][0]
        assert li["hs_code_matched"] is False
        assert li["service_flat_301"] == 0.0
        assert li["penalty_018"] == 0.0
        assert "hs_code_not_found:fallback_to_general_rate" in resp.json()["rules_applied"]
