"""
AI-Sourcing Hub — Pricing Module Tests

Covers:
  - Engine: ``estimate_volume_cbm``, ``calculate_landed_cost``, ``calculate``
  - Cache: exchange rate helpers (unit tests with mocked Redis)
  - API: pricing rule CRUD, calculate endpoint, exchange rate refresh
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
from decimal import Decimal
from typing import AsyncGenerator, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient, ASGITransport
from pytest import FixtureRequest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.pricing.engine import PricingEngine, LineItemInput
from app.modules.pricing.cache import (
    get_cached_exchange_rate,
    set_cached_exchange_rate,
    invalidate_exchange_rate,
    get_exchange_rate,
)
from app.shared.database import get_db
from app.shared.redis_client import get_redis_client


# ═══════════════════════════════════════════════════════════
# ── Engine Unit Tests ──
# ═══════════════════════════════════════════════════════════

class TestEstimateVolumeCbm:
    """Unit tests for ``PricingEngine.estimate_volume_cbm()``."""

    def test_zero_weight(self):
        """Zero weight returns minimum 0.1 CBM."""
        assert PricingEngine.estimate_volume_cbm(0) == 0.1

    def test_negative_weight(self):
        """Negative weight returns minimum 0.1 CBM."""
        assert PricingEngine.estimate_volume_cbm(-10) == 0.1

    def test_standard_density(self):
        """500 kg → 1 CBM (standard sea freight density)."""
        assert PricingEngine.estimate_volume_cbm(500) == 1.0

    def test_1000_kg(self):
        """1000 kg → 2 CBM."""
        assert PricingEngine.estimate_volume_cbm(1000) == 2.0

    def test_250_kg(self):
        """250 kg → 0.5 CBM."""
        assert PricingEngine.estimate_volume_cbm(250) == 0.5


class TestCalculateLandedCost:
    """Unit tests for ``PricingEngine.calculate_landed_cost()``."""

    def setup_method(self):
        self.engine = PricingEngine()

    def test_basic_calculation(self):
        """Verify the 9-step algorithm produces reasonable results."""
        result = self.engine.calculate_landed_cost(
            price_rmb=100.0,
            weight_kg=500.0,   # 1 CBM
            quantity=100,
            destination_port="Aqaba",
            currency="JOD",
            agent_commission_pct=3.0,
        )
        # Step 1: price_usd = 100 * 0.14 = 14.0
        assert result["price_usd"] == 14.0
        # Step 2: price_local = 14.0 * (0.077/0.14) ≈ 7.7
        assert result["price_local"] == pytest.approx(7.7, rel=0.01)
        # Step 3: volume_cbm = 500/500 = 1.0
        assert result["volume_cbm"] == 1.0
        # Step 4: freight = 75 * 1.0 / 100 = 0.75
        assert result["freight_per_unit"] == 0.75
        # Step 5: customs = 7.7 * 0.05 = 0.385
        assert result["customs_per_unit"] == pytest.approx(0.385, abs=0.01)
        # Step 6: clearance = 150 / 100 = 1.5
        assert result["clearance_per_unit"] == 1.5
        # Step 7: commission = (7.7 + 0.75 + 0.385 + 1.5) * 0.03 ≈ 0.31005
        total_before = 7.7 + 0.75 + 0.385 + 1.5
        assert result["commission_per_unit"] == pytest.approx(total_before * 0.03, rel=0.01)
        # Step 8: total_per_unit = total_before + commission
        assert result["total_per_unit"] == pytest.approx(total_before * 1.03, rel=0.01)
        # Step 9: grand_total = total_per_unit * quantity
        assert result["grand_total"] == pytest.approx(result["total_per_unit"] * 100, rel=0.01)

    def test_zero_quantity_raises(self):
        """Quantity of 0 should raise ValueError."""
        with pytest.raises(ValueError, match="Quantity must be > 0"):
            self.engine.calculate_landed_cost(
                price_rmb=100.0,
                weight_kg=500.0,
                quantity=0,
                destination_port="Aqaba",
                currency="JOD",
            )

    def test_negative_price_raises(self):
        """Negative price should raise ValueError."""
        with pytest.raises(ValueError, match="Price must be >= 0"):
            self.engine.calculate_landed_cost(
                price_rmb=-10.0,
                weight_kg=500.0,
                quantity=10,
                destination_port="Aqaba",
                currency="JOD",
            )

    def test_usd_target_currency(self):
        """Target currency USD skips the USD→local conversion."""
        result = self.engine.calculate_landed_cost(
            price_rmb=100.0,
            weight_kg=500.0,
            quantity=10,
            destination_port="Aqaba",
            currency="USD",
            agent_commission_pct=3.0,
        )
        assert result["currency"] == "USD"
        # price_usd = 100 * 0.14 = 14.0
        # price_local = price_usd (since USD target)
        assert result["price_local"] == 14.0

    def test_jeddah_port(self):
        """Jeddah port uses sea_freight_jeddah rule (60/CBM)."""
        result = self.engine.calculate_landed_cost(
            price_rmb=100.0,
            weight_kg=500.0,  # 1 CBM
            quantity=10,
            destination_port="Jeddah",
            currency="JOD",
            agent_commission_pct=3.0,
        )
        assert result["sea_freight_cbm"] == 60.0
        # freight_per_unit = 60 * 1.0 / 10 = 6.0
        assert result["freight_per_unit"] == 6.0

    def test_unknown_port_uses_default_freight(self):
        """Unknown port falls back to sea_freight_default."""
        result = self.engine.calculate_landed_cost(
            price_rmb=100.0,
            weight_kg=500.0,  # 1 CBM
            quantity=10,
            destination_port="UnknownPort",
            currency="JOD",
            agent_commission_pct=3.0,
        )
        assert result["sea_freight_cbm"] == 80.0

    def test_commission_on_total_before_commission(self):
        """Commission is calculated on (price + freight + customs + clearance)."""
        result = self.engine.calculate_landed_cost(
            price_rmb=100.0,
            weight_kg=500.0,
            quantity=10,
            destination_port="Aqaba",
            currency="JOD",
            agent_commission_pct=5.0,
        )
        total_before = (
            result["price_local"]
            + result["freight_per_unit"]
            + result["customs_per_unit"]
            + result["clearance_per_unit"]
        )
        expected_commission = total_before * 0.05
        assert result["commission_per_unit"] == pytest.approx(expected_commission, rel=0.01)

    def test_custom_rules_override(self):
        """Custom rules override DEFAULTS."""
        engine = PricingEngine(rules_override={
            "exchange_rate_cny_usd": 0.15,
            "sea_freight_aqaba": 100.0,
            "clearance_fee": 200.0,
        })
        result = engine.calculate_landed_cost(
            price_rmb=100.0,
            weight_kg=500.0,
            quantity=10,
            destination_port="Aqaba",
            currency="JOD",
            agent_commission_pct=3.0,
        )
        assert result["price_usd"] == 15.0  # 100 * 0.15
        assert result["sea_freight_cbm"] == 100.0
        assert result["clearance_per_unit"] == 20.0  # 200 / 10


class TestCalculate:
    """Unit tests for ``PricingEngine.calculate()``."""

    def setup_method(self):
        self.engine = PricingEngine()

    def test_single_product(self):
        """Single product calculate returns expected structure."""
        products = [
            LineItemInput(
                product_id="p1",
                product_name="Test Widget",
                quantity=100,
                unit_price_cny=50.0,
                weight_kg=500.0,
            )
        ]
        result = self.engine.calculate(
            rfq_id="test-rfq-1",
            target_currency="JOD",
            destination_port="Aqaba",
            products=products,
        )
        assert result["rfq_id"] == "test-rfq-1"
        assert len(result["line_items"]) == 1
        assert result["line_items"][0]["product_name"] == "Test Widget"
        assert result["grand_total"] > 0
        assert len(result["rules_applied"]) > 0

    def test_multiple_products(self):
        """Multiple products each get calculated correctly."""
        products = [
            LineItemInput(
                product_id="p1", product_name="Widget A",
                quantity=100, unit_price_cny=50.0, weight_kg=500.0,
            ),
            LineItemInput(
                product_id="p2", product_name="Widget B",
                quantity=200, unit_price_cny=30.0, weight_kg=200.0,
            ),
        ]
        result = self.engine.calculate(
            rfq_id="test-rfq-2",
            target_currency="JOD",
            destination_port="Aqaba",
            products=products,
        )
        assert len(result["line_items"]) == 2
        assert result["line_items"][0]["product_id"] == "p1"
        assert result["line_items"][1]["product_id"] == "p2"

    def test_moq_discount_tiers(self):
        """MOQ discount is applied correctly for different quantity tiers."""
        engine = PricingEngine()

        # 100 units — no discount
        r1 = engine.calculate(
            rfq_id="r1", target_currency="USD", destination_port="Aqaba",
            products=[LineItemInput(product_id="p", product_name="P", quantity=100, unit_price_cny=50.0)],
        )
        assert r1["line_items"][0]["discount"] == 0.0

        # 1000 units — 2% discount
        r2 = engine.calculate(
            rfq_id="r2", target_currency="USD", destination_port="Aqaba",
            products=[LineItemInput(product_id="p", product_name="P", quantity=1000, unit_price_cny=50.0)],
        )
        assert r2["line_items"][0]["discount"] > 0

        # 5000 units — 5% discount
        r3 = engine.calculate(
            rfq_id="r3", target_currency="USD", destination_port="Aqaba",
            products=[LineItemInput(product_id="p", product_name="P", quantity=5000, unit_price_cny=50.0)],
        )
        assert r3["line_items"][0]["discount"] > r2["line_items"][0]["discount"]

        # 10000 units — 8% discount
        r4 = engine.calculate(
            rfq_id="r4", target_currency="USD", destination_port="Aqaba",
            products=[LineItemInput(product_id="p", product_name="P", quantity=10000, unit_price_cny=50.0)],
        )
        assert r4["line_items"][0]["discount"] > r3["line_items"][0]["discount"]


# ═══════════════════════════════════════════════════════════
# ── Cache Unit Tests ──
# ═══════════════════════════════════════════════════════════

@pytest.fixture
def mock_redis():
    """Create a mock Redis client."""
    redis = AsyncMock(spec_set=[
        "get", "setex", "set", "delete", "exists", "expire",
    ])
    return redis


class TestCachedExchangeRate:
    """Unit tests for cache exchange rate functions."""

    @pytest.mark.asyncio
    async def test_get_cached_hit(self, mock_redis):
        """get_cached_exchange_rate returns float on cache hit."""
        from app.shared.redis_client import cache_get
        with patch("app.modules.pricing.cache.cache_get", new=AsyncMock(return_value="0.14")):
            rate = await get_cached_exchange_rate(mock_redis, "CNY", "USD")
            assert rate == 0.14

    @pytest.mark.asyncio
    async def test_get_cached_miss(self, mock_redis):
        """get_cached_exchange_rate returns None on cache miss."""
        with patch("app.modules.pricing.cache.cache_get", new=AsyncMock(return_value=None)):
            rate = await get_cached_exchange_rate(mock_redis, "CNY", "XYZ")
            assert rate is None

    @pytest.mark.asyncio
    async def test_set_cached(self, mock_redis):
        """set_cached_exchange_rate calls cache_set with correct key."""
        with patch("app.modules.pricing.cache.cache_set", new=AsyncMock()) as mock_set:
            await set_cached_exchange_rate(mock_redis, "CNY", "USD", 0.14)
            mock_set.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_invalidate(self, mock_redis):
        """invalidate_exchange_rate calls cache_delete."""
        with patch("app.modules.pricing.cache.cache_delete", new=AsyncMock()) as mock_del:
            await invalidate_exchange_rate(mock_redis, "CNY", "USD")
            mock_del.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_get_exchange_rate_cache_hit(self, mock_redis):
        """get_exchange_rate returns cached value without calling API."""
        with patch(
            "app.modules.pricing.cache.get_cached_exchange_rate",
            new=AsyncMock(return_value=0.14),
        ) as mock_cached:
            with patch(
                "app.modules.pricing.cache._fetch_exchange_rate_from_api",
                new=AsyncMock(),
            ) as mock_api:
                rate = await get_exchange_rate(mock_redis, "CNY", "USD")
                assert rate == 0.14
                mock_cached.assert_awaited_once()
                mock_api.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_get_exchange_rate_cache_miss_calls_api(self, mock_redis):
        """get_exchange_rate calls API on cache miss and caches result."""
        with patch(
            "app.modules.pricing.cache.get_cached_exchange_rate",
            new=AsyncMock(return_value=None),
        ):
            with patch(
                "app.modules.pricing.cache._fetch_exchange_rate_from_api",
                new=AsyncMock(return_value=0.14),
            ) as mock_api:
                with patch(
                    "app.modules.pricing.cache.set_cached_exchange_rate",
                    new=AsyncMock(),
                ) as mock_set:
                    rate = await get_exchange_rate(mock_redis, "CNY", "USD")
                    assert rate == 0.14
                    mock_api.assert_awaited_once_with("CNY", "USD")
                    mock_set.assert_awaited_once()


# ═══════════════════════════════════════════════════════════
# ── API Integration Tests ──
# ═══════════════════════════════════════════════════════════

@pytest.fixture
def app(db_session: AsyncSession):
    """Override the conftest app to inject DB session and mock Redis."""
    from app.main import create_app

    application = create_app()

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    async def override_get_redis():
        """Yield an AsyncMock Redis client to avoid needing a real Redis server."""
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
    """Register a user and return auth headers."""
    from app.modules.auth.models import UserRole

    register_payload = {
        "email": "pricing_test@example.com",
        "password": "TestPass123!",
        "full_name": "Pricing Test User",
        "role": UserRole.AGENT.value,
    }
    resp = await client.post("/api/v1/auth/register", json=register_payload)
    assert resp.status_code == 201
    # Login to get access token (register returns UserResponse, not tokens)
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": register_payload["email"],
        "password": register_payload["password"],
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def admin_headers(client: AsyncClient, db_session: AsyncSession) -> dict:
    """Register an admin and return auth headers."""
    from app.modules.auth.models import UserRole

    register_payload = {
        "email": "pricing_admin@example.com",
        "password": "AdminPass123!",
        "full_name": "Pricing Admin",
        "role": UserRole.ADMIN.value,
    }
    resp = await client.post("/api/v1/auth/register", json=register_payload)
    assert resp.status_code == 201
    # Login to get access token (register returns UserResponse, not tokens)
    login_resp = await client.post("/api/v1/auth/login", json={
        "email": register_payload["email"],
        "password": register_payload["password"],
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestPricingRulesAPI:
    """CRUD tests for /api/v1/pricing/rules."""

    @pytest.mark.asyncio
    async def test_list_rules_empty(self, client: AsyncClient, auth_headers: dict):
        """GET /rules returns empty list when no rules exist."""
        resp = await client.get("/api/v1/pricing/rules", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["items"] == []

    @pytest.mark.asyncio
    async def test_create_rule(self, client: AsyncClient, admin_headers: dict, db_session: AsyncSession):
        """POST /rules creates a pricing rule (admin only)."""
        resp = await client.post(
            "/api/v1/pricing/rules",
            headers=admin_headers,
            json={
                "name": "test_freight_rate",
                "description": "Test freight rate",
                "category": "freight",
                "rule_type": "fixed",
                "value": 100.0,
                "priority": 1,
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "test_freight_rate"
        assert data["value"] == 100.0
        assert data["category"] == "freight"

    @pytest.mark.asyncio
    async def test_create_rule_requires_admin(self, client: AsyncClient, auth_headers: dict):
        """Non-admin cannot create rules (403)."""
        resp = await client.post(
            "/api/v1/pricing/rules",
            headers=auth_headers,
            json={
                "name": "test_unauthorized",
                "category": "freight",
                "rule_type": "fixed",
                "value": 50.0,
            },
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_get_rule(self, client: AsyncClient, admin_headers: dict, auth_headers: dict, db_session: AsyncSession):
        """GET /rules/{id} returns rule details."""
        # Create rule first
        create_resp = await client.post(
            "/api/v1/pricing/rules",
            headers=admin_headers,
            json={
                "name": "get_test_rule",
                "category": "exchange_rate",
                "rule_type": "fixed",
                "value": 0.5,
            },
        )
        rule_id = create_resp.json()["id"]

        # Get rule
        resp = await client.get(f"/api/v1/pricing/rules/{rule_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["name"] == "get_test_rule"

    @pytest.mark.asyncio
    async def test_get_rule_not_found(self, client: AsyncClient, auth_headers: dict):
        """GET /rules/{id} returns 404 for nonexistent rule."""
        resp = await client.get(
            "/api/v1/pricing/rules/00000000-0000-0000-0000-000000000000",
            headers=auth_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_update_rule(self, client: AsyncClient, admin_headers: dict, auth_headers: dict, db_session: AsyncSession):
        """PUT /rules/{id} updates rule value."""
        # Create
        create_resp = await client.post(
            "/api/v1/pricing/rules",
            headers=admin_headers,
            json={
                "name": "update_test_rule",
                "category": "commission",
                "rule_type": "percentage",
                "value": 0.03,
            },
        )
        rule_id = create_resp.json()["id"]

        # Update
        resp = await client.put(
            f"/api/v1/pricing/rules/{rule_id}",
            headers=admin_headers,
            json={
                "name": "update_test_rule",
                "category": "commission",
                "rule_type": "percentage",
                "value": 0.05,
            },
        )
        assert resp.status_code == 200
        assert resp.json()["value"] == 0.05

    @pytest.mark.asyncio
    async def test_delete_rule(self, client: AsyncClient, admin_headers: dict, auth_headers: dict, db_session: AsyncSession):
        """DELETE /rules/{id} deletes rule (204)."""
        # Create
        create_resp = await client.post(
            "/api/v1/pricing/rules",
            headers=admin_headers,
            json={
                "name": "delete_test_rule",
                "category": "margin",
                "rule_type": "percentage",
                "value": 0.15,
            },
        )
        rule_id = create_resp.json()["id"]

        # Delete
        resp = await client.delete(
            f"/api/v1/pricing/rules/{rule_id}",
            headers=admin_headers,
        )
        assert resp.status_code == 204


class TestPricingCalculateAPI:
    """Integration tests for POST /api/v1/pricing/calculate."""

    @pytest.mark.asyncio
    async def test_calculate_basic(self, client: AsyncClient, auth_headers: dict):
        """POST /calculate returns correct structure."""
        resp = await client.post(
            "/api/v1/pricing/calculate",
            headers=auth_headers,
            json={
                "rfq_id": "test-rfq-calc",
                "target_currency": "JOD",
                "destination_port": "Aqaba",
                "products": [
                    {
                        "product_id": "prod-1",
                        "name": "Test Widget",
                        "quantity": 100,
                        "unit_price_cny": 50.0,
                    }
                ],
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["rfq_id"] == "test-rfq-calc"
        assert data["target_currency"] == "JOD"
        assert len(data["line_items"]) == 1
        assert data["grand_total"] > 0
        assert len(data["rules_applied"]) > 0

    @pytest.mark.asyncio
    async def test_calculate_multiple_products(self, client: AsyncClient, auth_headers: dict):
        """POST /calculate handles multiple products."""
        resp = await client.post(
            "/api/v1/pricing/calculate",
            headers=auth_headers,
            json={
                "rfq_id": "test-rfq-multi",
                "target_currency": "USD",
                "destination_port": "Jeddah",
                "products": [
                    {"product_id": "p1", "name": "Widget A", "quantity": 50, "unit_price_cny": 100.0},
                    {"product_id": "p2", "name": "Widget B", "quantity": 100, "unit_price_cny": 20.0},
                ],
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["line_items"]) == 2
        # Different products should have different totals
        assert data["line_items"][0]["total"] != data["line_items"][1]["total"]

    @pytest.mark.asyncio
    async def test_calculate_requires_auth(self, client: AsyncClient):
        """POST /calculate without auth returns 401."""
        resp = await client.post(
            "/api/v1/pricing/calculate",
            json={
                "rfq_id": "test",
                "target_currency": "JOD",
                "destination_port": "Aqaba",
                "products": [],
            },
        )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_calculate_empty_products(self, client: AsyncClient, auth_headers: dict):
        """POST /calculate with empty products list."""
        resp = await client.post(
            "/api/v1/pricing/calculate",
            headers=auth_headers,
            json={
                "rfq_id": "test-empty",
                "target_currency": "JOD",
                "destination_port": "Aqaba",
                "products": [],
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["line_items"] == []


class TestPricingExchangeRatesAPI:
    """Tests for POST /api/v1/pricing/exchange-rates/refresh."""

    @pytest.mark.asyncio
    async def test_refresh_requires_admin(self, client: AsyncClient, auth_headers: dict):
        """Non-admin cannot refresh rates (403)."""
        resp = await client.post(
            "/api/v1/pricing/exchange-rates/refresh",
            headers=auth_headers,
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_refresh_no_api_key(self, client: AsyncClient, admin_headers: dict):
        """Refresh with no API key returns empty rates (graceful)."""
        resp = await client.post(
            "/api/v1/pricing/exchange-rates/refresh",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"


class TestPricingRuleHistory:
    """Tests for GET /api/v1/pricing/rules/{id}/history."""

    @pytest.mark.asyncio
    async def test_history_stub(self, client: AsyncClient, auth_headers: dict):
        """GET /rules/{id}/history returns stub (Phase 5 placeholder)."""
        resp = await client.get(
            "/api/v1/pricing/rules/00000000-0000-0000-0000-000000000000/history",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "history" in data
        assert data["history"] == []
