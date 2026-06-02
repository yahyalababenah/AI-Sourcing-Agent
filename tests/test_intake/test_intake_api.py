"""
AI-Sourcing Hub — Intake Module API Tests

Tests all intake endpoints:
    - POST /api/v1/intake/translate    (translate Arabic → Chinese)
    - POST /api/v1/intake/rfqs         (create RFQ)
    - GET  /api/v1/intake/rfqs         (list RFQs, paginated)
    - GET  /api/v1/intake/rfqs/{id}    (get RFQ detail)
    - PUT  /api/v1/intake/rfqs/{id}/status  (update RFQ status)
    - POST /api/v1/intake/rfqs/{id}/products (add product to RFQ)
    - GET  /api/v1/intake/rfqs/{id}/products (list products)

Covers all Phase 2 verification steps from the roadmap.
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
from unittest.mock import patch

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
    """Register a test agent user and return credentials."""
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "intake_agent@test.com",
            "password": "test_password_123",
            "full_name": "Intake Agent",
        },
    )
    assert response.status_code == 201
    return {"email": "intake_agent@test.com", "password": "test_password_123"}


@pytest.fixture
async def auth_headers(client: AsyncClient, registered_user: dict) -> dict:
    """Login and return Authorization headers for the test agent."""
    response = await client.post(
        "/api/v1/auth/login",
        json=registered_user,
    )
    tokens = response.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.fixture
async def sample_rfq_data() -> dict:
    """Sample RFQ creation payload."""
    return {
        "client_name": "Ali Import Co.",
        "client_phone": "+962791234567",
        "client_request_arabic": "عاوز 500 كرتونة صابون زيت زيتون حلب",
        "translated_query_chinese": "需要500箱阿勒颇橄榄皂",
        "extracted_entities": {
            "products": [
                {
                    "name_arabic": "صابون زيت زيتون حلب",
                    "quantity": 500,
                    "unit": "كرتونة",
                    "specifications": "وزن 200 جرام للقطعة",
                }
            ],
            "destination_port": "العقبة",
            "target_currency": "JOD",
            "urgency": "normal",
        },
        "destination_port": "العقبة",
        "target_currency": "JOD",
    }


# ═══════════════════════════════════════════════════════════
# Translation Tests
# ═══════════════════════════════════════════════════════════

MOCK_TRANSLATE_RESPONSE = {
    "request_id": "mock-req-123",
    "chinese_query": "需要500箱阿勒颇橄榄皂，每块200克",
    "entities": {
        "products": [
            {
                "name_arabic": "صابون زيت زيتون حلب",
                "quantity": 500,
                "unit": "كرتونة",
                "specifications": "وزن 200 جرام للقطعة",
            }
        ],
        "destination_port": "السويس",
        "target_currency": None,
        "urgency": "normal",
    },
    "confidence": 0.9,
}


class TestTranslate:
    """POST /api/v1/intake/translate"""

    @patch("app.modules.intake.service.translate_and_extract")
    async def test_translate_success(
        self,
        mock_translate,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Should translate Arabic text and return entities."""
        mock_translate.return_value = MOCK_TRANSLATE_RESPONSE

        response = await client.post(
            "/api/v1/intake/translate",
            json={
                "raw_text": "عاوز 500 كرتونة صابون زيت زيتون حلب بوزن 200 جرام"
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["request_id"] == "mock-req-123"
        assert "阿勒颇橄榄皂" in data["chinese_query"]
        assert len(data["entities"]["products"]) == 1
        assert data["confidence"] == 0.9

        # Verify the LLM was called with correct text
        mock_translate.assert_called_once()
        args, kwargs = mock_translate.call_args
        assert "صابون" in kwargs.get("arabic_text", args[0])

    @patch("app.modules.intake.service.translate_and_extract")
    async def test_translate_multiple_products(
        self,
        mock_translate,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Should handle Arabic text with multiple products."""
        mock_translate.return_value = {
            "request_id": "mock-req-456",
            "chinese_query": "需要200套餐具和300个炒锅",
            "entities": {
                "products": [
                    {
                        "name_arabic": "طقم أدوات مطبخ جرانيت",
                        "quantity": 200,
                        "unit": "طقم",
                        "specifications": "12 قطعة لون أحمر",
                    },
                    {
                        "name_arabic": "مقلاة تيفال",
                        "quantity": 300,
                        "unit": "قطعة",
                        "specifications": "قاعدة سميكة قطر 30 سم",
                    },
                ],
                "destination_port": "العقبة",
                "target_currency": "JOD",
                "urgency": "normal",
            },
            "confidence": 0.85,
        }

        response = await client.post(
            "/api/v1/intake/translate",
            json={
                "raw_text": "بدي 200 طقم أدوات مطبخ جرانيت لون أحمر و 300 مقلاة تيفال عالعقبة"
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["entities"]["products"]) == 2

    async def test_translate_empty_text(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Should reject empty Arabic text."""
        response = await client.post(
            "/api/v1/intake/translate",
            json={"raw_text": ""},
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_translate_text_too_long(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Should reject text exceeding max_length (5000 chars)."""
        response = await client.post(
            "/api/v1/intake/translate",
            json={"raw_text": "x" * 5001},
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_translate_requires_auth(self, client: AsyncClient):
        """Should return 401 without authentication."""
        response = await client.post(
            "/api/v1/intake/translate",
            json={"raw_text": "عاوز 500 كرتونة صابون"},
        )
        assert response.status_code == 401

    @patch("app.modules.intake.service.translate_and_extract")
    async def test_translate_gulf_dialect(
        self,
        mock_translate,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Should handle Gulf Arabic dialect."""
        mock_translate.return_value = {
            "request_id": "mock-req-789",
            "chinese_query": "需要1000部三星Galaxy X24手机",
            "entities": {
                "products": [
                    {
                        "name_arabic": "جوال سامسونج Galaxy X24",
                        "quantity": 1000,
                        "unit": "حبة",
                        "specifications": "لون أسود",
                    }
                ],
                "destination_port": None,
                "target_currency": None,
                "urgency": "urgent",
            },
            "confidence": 0.95,
        }

        response = await client.post(
            "/api/v1/intake/translate",
            json={
                "raw_text": "ابي 1000 حبة جوال سامسونج غالي اكس 24 لون اسود. دشها بسرعة ابيها خلال اسبوع"
            },
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["entities"]["urgency"] == "urgent"


# ═══════════════════════════════════════════════════════════
# RFQ CRUD Tests
# ═══════════════════════════════════════════════════════════


class TestCreateRFQ:
    """POST /api/v1/intake/rfqs"""

    async def test_create_rfq_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
        sample_rfq_data: dict,
    ):
        """Should create an RFQ and return its details."""
        response = await client.post(
            "/api/v1/intake/rfqs",
            json=sample_rfq_data,
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["client_name"] == "Ali Import Co."
        assert data["status"] == "open"
        assert data["target_currency"] == "JOD"
        assert "id" in data
        assert "agent_id" in data
        assert "created_at" in data

    async def test_create_rfq_minimal(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Should create RFQ with only required fields."""
        response = await client.post(
            "/api/v1/intake/rfqs",
            json={},
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "open"
        assert data["client_name"] is None

    async def test_create_rfq_requires_auth(
        self,
        client: AsyncClient,
        sample_rfq_data: dict,
    ):
        """Should return 401 without authentication."""
        response = await client.post(
            "/api/v1/intake/rfqs",
            json=sample_rfq_data,
        )
        assert response.status_code == 401


class TestListRFQs:
    """GET /api/v1/intake/rfqs"""

    @pytest.fixture
    async def multiple_rfqs(
        self,
        client: AsyncClient,
        auth_headers: dict,
        sample_rfq_data: dict,
    ):
        """Create multiple RFQs for pagination testing."""
        created = []
        for i in range(5):
            data = dict(sample_rfq_data)
            data["client_name"] = f"Client {i}"
            resp = await client.post(
                "/api/v1/intake/rfqs",
                json=data,
                headers=auth_headers,
            )
            assert resp.status_code == 201
            created.append(resp.json())
        return created

    async def test_list_rfqs_default_pagination(
        self,
        client: AsyncClient,
        auth_headers: dict,
        multiple_rfqs: list,
    ):
        """Should list RFQs with default pagination (page=1, page_size=20)."""
        response = await client.get(
            "/api/v1/intake/rfqs",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 5
        assert data["page"] == 1
        assert data["page_size"] == 20
        assert len(data["items"]) >= 5

    async def test_list_rfqs_with_pagination(
        self,
        client: AsyncClient,
        auth_headers: dict,
        multiple_rfqs: list,
    ):
        """Should respect page and page_size parameters."""
        response = await client.get(
            "/api/v1/intake/rfqs?page=1&page_size=2",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 2
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert data["total_pages"] >= 3

        # Get second page
        response2 = await client.get(
            "/api/v1/intake/rfqs?page=2&page_size=2",
            headers=auth_headers,
        )
        data2 = response2.json()
        assert len(data2["items"]) == 2
        assert data2["page"] == 2
        # Ensure different items on different pages
        assert data["items"][0]["id"] != data2["items"][0]["id"]

    async def test_list_rfqs_orders_by_newest(
        self,
        client: AsyncClient,
        auth_headers: dict,
        multiple_rfqs: list,
    ):
        """Should return RFQs ordered by created_at descending."""
        response = await client.get(
            "/api/v1/intake/rfqs",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        timestamps = [item["created_at"] for item in data["items"]]
        assert timestamps == sorted(timestamps, reverse=True)

    async def test_list_rfqs_requires_auth(self, client: AsyncClient):
        """Should return 401 without authentication."""
        response = await client.get("/api/v1/intake/rfqs")
        assert response.status_code == 401


class TestGetRFQ:
    """GET /api/v1/intake/rfqs/{rfq_id}"""

    async def test_get_rfq_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
        sample_rfq_data: dict,
    ):
        """Should return RFQ details by ID."""
        # Create first
        create_resp = await client.post(
            "/api/v1/intake/rfqs",
            json=sample_rfq_data,
            headers=auth_headers,
        )
        rfq_id = create_resp.json()["id"]

        # Get by ID
        response = await client.get(
            f"/api/v1/intake/rfqs/{rfq_id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == rfq_id
        assert data["client_name"] == "Ali Import Co."
        assert data["destination_port"] == "العقبة"

    async def test_get_rfq_not_found(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Should return 404 for non-existent RFQ."""
        response = await client.get(
            "/api/v1/intake/rfqs/00000000-0000-0000-0000-000000000000",
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestUpdateRFQStatus:
    """PUT /api/v1/intake/rfqs/{rfq_id}/status"""

    @pytest.fixture
    async def created_rfq(
        self,
        client: AsyncClient,
        auth_headers: dict,
        sample_rfq_data: dict,
    ) -> dict:
        """Create an RFQ and return its data."""
        resp = await client.post(
            "/api/v1/intake/rfqs",
            json=sample_rfq_data,
            headers=auth_headers,
        )
        assert resp.status_code == 201
        return resp.json()

    async def test_update_status_valid_transition(
        self,
        client: AsyncClient,
        auth_headers: dict,
        created_rfq: dict,
    ):
        """Should transition from open → processing."""
        response = await client.put(
            f"/api/v1/intake/rfqs/{created_rfq['id']}/status",
            params={"new_status": "processing"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "processing"

    async def test_update_status_invalid_transition(
        self,
        client: AsyncClient,
        auth_headers: dict,
        created_rfq: dict,
    ):
        """Should reject invalid status transition (open → quoted)."""
        response = await client.put(
            f"/api/v1/intake/rfqs/{created_rfq['id']}/status",
            params={"new_status": "quoted"},
            headers=auth_headers,
        )

        assert response.status_code == 422
        data = response.json()
        assert "error" in data
        assert "code" in data["error"]

    async def test_update_status_full_flow(
        self,
        client: AsyncClient,
        auth_headers: dict,
        created_rfq: dict,
    ):
        """Should follow valid state machine: open → processing → quoted → closed."""
        rfq_id = created_rfq["id"]

        # open → processing
        resp = await client.put(
            f"/api/v1/intake/rfqs/{rfq_id}/status",
            params={"new_status": "processing"},
            headers=auth_headers,
        )
        assert resp.json()["status"] == "processing"

        # processing → quoted
        resp = await client.put(
            f"/api/v1/intake/rfqs/{rfq_id}/status",
            params={"new_status": "quoted"},
            headers=auth_headers,
        )
        assert resp.json()["status"] == "quoted"

        # quoted → closed
        resp = await client.put(
            f"/api/v1/intake/rfqs/{rfq_id}/status",
            params={"new_status": "closed"},
            headers=auth_headers,
        )
        assert resp.json()["status"] == "closed"

    async def test_update_status_cancelled_terminal(
        self,
        client: AsyncClient,
        auth_headers: dict,
        created_rfq: dict,
    ):
        """Should allow open → cancelled, then reject further transitions."""
        rfq_id = created_rfq["id"]

        # open → cancelled
        resp = await client.put(
            f"/api/v1/intake/rfqs/{rfq_id}/status",
            params={"new_status": "cancelled"},
            headers=auth_headers,
        )
        assert resp.json()["status"] == "cancelled"

        # cancelled → anything should fail
        resp = await client.put(
            f"/api/v1/intake/rfqs/{rfq_id}/status",
            params={"new_status": "processing"},
            headers=auth_headers,
        )
        assert resp.status_code == 422


# ═══════════════════════════════════════════════════════════
# Product Tests
# ═══════════════════════════════════════════════════════════


class TestAddProduct:
    """POST /api/v1/intake/rfqs/{rfq_id}/products"""

    @pytest.fixture
    async def created_rfq(
        self,
        client: AsyncClient,
        auth_headers: dict,
        sample_rfq_data: dict,
    ) -> dict:
        """Create an RFQ and return its data."""
        resp = await client.post(
            "/api/v1/intake/rfqs",
            json=sample_rfq_data,
            headers=auth_headers,
        )
        return resp.json()

    async def test_add_product_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
        created_rfq: dict,
    ):
        """Should add a product to an RFQ."""
        response = await client.post(
            f"/api/v1/intake/rfqs/{created_rfq['id']}/products",
            params={
                "name": "صابون زيت زيتون حلب",
                "quantity": 500,
                "specifications": "وزن 200 جرام للقطعة",
            },
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "صابون زيت زيتون حلب"
        assert data["quantity"] == 500
        assert data["status"] == "pending"
        assert "id" in data

    async def test_add_product_empty_name(
        self,
        client: AsyncClient,
        auth_headers: dict,
        created_rfq: dict,
    ):
        """Should reject product with empty name."""
        response = await client.post(
            f"/api/v1/intake/rfqs/{created_rfq['id']}/products",
            params={"name": "", "quantity": 1},
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_add_product_zero_quantity(
        self,
        client: AsyncClient,
        auth_headers: dict,
        created_rfq: dict,
    ):
        """Should reject product with quantity 0."""
        response = await client.post(
            f"/api/v1/intake/rfqs/{created_rfq['id']}/products",
            params={"name": "Test Product", "quantity": 0},
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_add_product_to_nonexistent_rfq(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Should return 404 when adding to non-existent RFQ."""
        response = await client.post(
            "/api/v1/intake/rfqs/00000000-0000-0000-0000-000000000000/products",
            params={"name": "Test Product", "quantity": 10},
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestListProducts:
    """GET /api/v1/intake/rfqs/{rfq_id}/products"""

    @pytest.fixture
    async def rfq_with_products(
        self,
        client: AsyncClient,
        auth_headers: dict,
        sample_rfq_data: dict,
    ) -> dict:
        """Create RFQ with multiple products and return data."""
        # Create RFQ
        resp = await client.post(
            "/api/v1/intake/rfqs",
            json=sample_rfq_data,
            headers=auth_headers,
        )
        rfq = resp.json()
        rfq_id = rfq["id"]

        # Add products
        products_data = [
            ("صابون زيت زيتون حلب", 500, "وزن 200 جرام"),
            ("طقم أدوات مطبخ جرانيت", 200, "12 قطعة لون أحمر"),
            ("مكيف سبليت 18000 وحدة", 300, "ماركة جري"),
        ]
        for name, qty, specs in products_data:
            await client.post(
                f"/api/v1/intake/rfqs/{rfq_id}/products",
                params={"name": name, "quantity": qty, "specifications": specs},
                headers=auth_headers,
            )

        rfq["product_count"] = len(products_data)
        return rfq

    async def test_list_products_success(
        self,
        client: AsyncClient,
        auth_headers: dict,
        rfq_with_products: dict,
    ):
        """Should list all products in an RFQ."""
        rfq_id = rfq_with_products["id"]
        response = await client.get(
            f"/api/v1/intake/rfqs/{rfq_id}/products",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        names = [p["name"] for p in data]
        assert "صابون زيت زيتون حلب" in names
        assert "طقم أدوات مطبخ جرانيت" in names
        assert "مكيف سبليت 18000 وحدة" in names

    async def test_list_products_empty(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Should return empty list for RFQ with no products."""
        # Need to create RFQ first
        resp = await client.post(
            "/api/v1/intake/rfqs",
            json={"client_name": "Empty RFQ"},
            headers=auth_headers,
        )
        rfq_id = resp.json()["id"]

        response = await client.get(
            f"/api/v1/intake/rfqs/{rfq_id}/products",
            headers=auth_headers,
        )

        assert response.status_code == 200
        assert response.json() == []

    async def test_list_products_nonexistent_rfq(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Should return 404 for non-existent RFQ."""
        response = await client.get(
            "/api/v1/intake/rfqs/00000000-0000-0000-0000-000000000000/products",
            headers=auth_headers,
        )
        assert response.status_code == 404

    async def test_list_products_requires_auth(
        self,
        client: AsyncClient,
        rfq_with_products: dict,
    ):
        """Should return 401 without authentication."""
        response = await client.get(
            f"/api/v1/intake/rfqs/{rfq_with_products['id']}/products",
        )
        assert response.status_code == 401
