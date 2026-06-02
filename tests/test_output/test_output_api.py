"""
AI-Sourcing Hub — Output (Quotation) Module Test Suite

Covers:
    - POST /api/v1/quotes (create quotation)
    - GET /api/v1/quotes (list quotations)
    - GET /api/v1/quotes/{id} (get quotation by ID)
    - PUT /api/v1/quotes/{id}/status (update quotation status)
    - POST /api/v1/quotes/generate (async Celery dispatch)
    - GET /api/v1/quotes/{id}/pdf (PDF redirect)
    - POST /api/v1/quotes/{id}/finalize (finalize quotation)
    - Authentication & authorization guards
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import uuid
from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func

from app.modules.output.models import Quotation

pytestmark = pytest.mark.asyncio


# ═══════════════════════════════════════════════════════════
# Fixtures
# ═══════════════════════════════════════════════════════════


@pytest.fixture
async def sample_rfq(client: AsyncClient, auth_headers: dict) -> dict:
    """Create a sample RFQ for testing."""
    response = await client.post(
        "/api/v1/intake/rfqs",
        json={
            "supplier_name": "Test Supplier",
            "commodity": "Test Electronics",
            "source": "china",
            "destination": "Aqaba",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    return response.json()


@pytest.fixture
async def sample_quotation(
    client: AsyncClient, auth_headers: dict, sample_rfq: dict
) -> dict:
    """Create a sample quotation for testing."""
    response = await client.post(
        "/api/v1/quotes",
        json={
            "rfq_id": sample_rfq["id"],
            "target_currency": "JOD",
            "exchange_rate_used": 0.709,
            "line_items": [
                {
                    "product_id": "00000000-0000-0000-0000-000000000001",
                    "product_name": "Test Widget",
                    "quantity": 100,
                    "unit_price_cny": 5.0,
                    "unit_price_converted": 3.545,
                    "exchange_rate": 0.709,
                    "freight_cost": 10.0,
                    "customs_duty": 5.0,
                    "commission": 2.5,
                    "subtotal": 50.0,
                    "discount": 0.0,
                    "total": 67.5,
                }
            ],
            "subtotal": 50.0,
            "freight_total": 10.0,
            "customs_total": 5.0,
            "commission_total": 2.5,
            "discount_total": 0.0,
            "vat_total": 0.0,
            "grand_total": 67.5,
            "payment_terms": "30% deposit, 70% before shipment",
            "delivery_terms": "FOB Shanghai",
            "validity_days": 30,
            "notes": "Test quotation",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    return response.json()


# ═══════════════════════════════════════════════════════════
# Tests: Create Quotation
# ═══════════════════════════════════════════════════════════


class TestCreateQuotation:
    """POST /api/v1/quotes"""

    async def test_create_quotation_success(
        self, client: AsyncClient, auth_headers: dict, sample_rfq: dict
    ):
        """Should create a quotation with valid data."""
        response = await client.post(
            "/api/v1/quotes",
            json={
                "rfq_id": sample_rfq["id"],
                "target_currency": "JOD",
                "exchange_rate_used": 0.709,
                "line_items": [
                    {
                        "product_id": "00000000-0000-0000-0000-000000000001",
                        "product_name": "Test Widget",
                        "quantity": 100,
                        "unit_price_cny": 5.0,
                        "unit_price_converted": 3.545,
                        "exchange_rate": 0.709,
                        "freight_cost": 0.0,
                        "customs_duty": 0.0,
                        "commission": 0.0,
                        "subtotal": 50.0,
                        "discount": 0.0,
                        "total": 50.0,
                    }
                ],
                "subtotal": 50.0,
                "grand_total": 50.0,
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "draft"
        assert data["target_currency"] == "JOD"
        assert data["grand_total"] == 50.0
        assert "id" in data
        assert "quotation_number" in data

    async def test_create_quotation_requires_auth(
        self, client: AsyncClient, sample_rfq: dict
    ):
        """Should reject unauthenticated request."""
        response = await client.post(
            "/api/v1/quotes",
            json={
                "rfq_id": sample_rfq["id"],
                "target_currency": "JOD",
                "exchange_rate_used": 0.709,
                "line_items": [],
                "subtotal": 0.0,
                "grand_total": 0.0,
            },
        )
        assert response.status_code == 401

    async def test_create_quotation_invalid_rfq(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Should reject with non-existent RFQ."""
        response = await client.post(
            "/api/v1/quotes",
            json={
                "rfq_id": str(uuid.uuid4()),
                "target_currency": "JOD",
                "exchange_rate_used": 0.709,
                "line_items": [],
                "subtotal": 0.0,
                "grand_total": 0.0,
            },
            headers=auth_headers,
        )
        assert response.status_code == 404


# ═══════════════════════════════════════════════════════════
# Tests: List Quotations
# ═══════════════════════════════════════════════════════════


class TestListQuotations:
    """GET /api/v1/quotes"""

    async def test_list_quotations_success(
        self, client: AsyncClient, auth_headers: dict, sample_quotation: dict
    ):
        """Should return paginated list of quotations."""
        response = await client.get(
            "/api/v1/quotes",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) >= 1
        assert data["total"] >= 1

    async def test_list_quotations_requires_auth(
        self, client: AsyncClient
    ):
        """Should reject unauthenticated request."""
        response = await client.get("/api/v1/quotes")
        assert response.status_code == 401

    async def test_list_quotations_by_status(
        self, client: AsyncClient, auth_headers: dict, sample_quotation: dict
    ):
        """Should filter by status."""
        response = await client.get(
            "/api/v1/quotes?status=draft",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        for item in data["items"]:
            assert item["status"] == "draft"


# ═══════════════════════════════════════════════════════════
# Tests: Get Quotation
# ═══════════════════════════════════════════════════════════


class TestGetQuotation:
    """GET /api/v1/quotes/{id}"""

    async def test_get_quotation_success(
        self, client: AsyncClient, auth_headers: dict, sample_quotation: dict
    ):
        """Should return quotation by ID."""
        response = await client.get(
            f"/api/v1/quotes/{sample_quotation['id']}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_quotation["id"]
        assert data["grand_total"] == 67.5
        assert data["status"] == "draft"

    async def test_get_quotation_not_found(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Should return 404 for non-existent quotation."""
        response = await client.get(
            f"/api/v1/quotes/{uuid.uuid4()}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    async def test_get_quotation_requires_auth(
        self, client: AsyncClient, sample_quotation: dict
    ):
        """Should reject unauthenticated request."""
        response = await client.get(
            f"/api/v1/quotes/{sample_quotation['id']}"
        )
        assert response.status_code == 401


# ═══════════════════════════════════════════════════════════
# Tests: Update Quotation Status
# ═══════════════════════════════════════════════════════════


class TestUpdateQuotationStatus:
    """PUT /api/v1/quotes/{id}/status"""

    async def test_update_status_success(
        self, client: AsyncClient, auth_headers: dict, sample_quotation: dict
    ):
        """Should transition from draft to finalized."""
        response = await client.put(
            f"/api/v1/quotes/{sample_quotation['id']}/status?new_status=finalized",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "finalized"

    async def test_update_status_invalid_transition(
        self, client: AsyncClient, auth_headers: dict, sample_quotation: dict
    ):
        """Should reject invalid status transition (draft -> invalid)."""
        response = await client.put(
            f"/api/v1/quotes/{sample_quotation['id']}/status?new_status=invalid",
            headers=auth_headers,
        )
        assert response.status_code == 422


# ═══════════════════════════════════════════════════════════
# Tests: Generate Quotation (Async Celery Dispatch)
# ═══════════════════════════════════════════════════════════


class TestGenerateQuotation:
    """POST /api/v1/quotes/generate"""

    @patch("app.modules.output.tasks.generate_quotation_pdf_task.delay")
    async def test_generate_async_success(
        self,
        mock_delay,
        client: AsyncClient,
        auth_headers: dict,
        sample_rfq: dict,
    ):
        """Should create quotation and enqueue Celery task."""
        mock_delay.return_value = None

        response = await client.post(
            "/api/v1/quotes/generate",
            json={
                "rfq_id": sample_rfq["id"],
                "target_currency": "JOD",
                "exchange_rate_used": 0.709,
                "line_items": [
                    {
                        "product_id": "00000000-0000-0000-0000-000000000002",
                        "product_name": "Async Widget",
                        "quantity": 50,
                        "unit_price_cny": 10.0,
                        "unit_price_converted": 7.09,
                        "exchange_rate": 0.709,
                        "freight_cost": 0.0,
                        "customs_duty": 0.0,
                        "commission": 0.0,
                        "subtotal": 50.0,
                        "discount": 0.0,
                        "total": 50.0,
                    }
                ],
                "subtotal": 50.0,
                "grand_total": 50.0,
                "payment_terms": "100% TT",
                "delivery_terms": "CIF Aqaba",
                "validity_days": 30,
            },
            headers=auth_headers,
        )
        assert response.status_code == 202
        data = response.json()
        assert "quotation_id" in data
        assert data["status"] == "pending"
        assert mock_delay.called

    async def test_generate_requires_auth(
        self, client: AsyncClient, sample_rfq: dict
    ):
        """Should reject unauthenticated request."""
        response = await client.post(
            "/api/v1/quotes/generate",
            json={
                "rfq_id": sample_rfq["id"],
                "target_currency": "JOD",
                "exchange_rate_used": 0.709,
                "line_items": [],
                "subtotal": 0.0,
                "grand_total": 0.0,
            },
        )
        assert response.status_code == 401


# ═══════════════════════════════════════════════════════════
# Tests: Get PDF Redirect
# ═══════════════════════════════════════════════════════════


class TestGetPdfRedirect:
    """GET /api/v1/quotes/{id}/pdf"""

    @patch("app.shared.storage.storage_client.get_presigned_url")
    async def test_get_pdf_redirect_success(
        self,
        mock_get_url,
        client: AsyncClient,
        auth_headers: dict,
        sample_quotation: dict,
        db_session: AsyncSession,
    ):
        """Should redirect to presigned PDF URL."""
        mock_get_url.return_value = "https://minio.example.com/quotes/test.pdf"

        # Set pdf_path directly via DB to simulate a generated PDF
        stmt = (
            update(Quotation)
            .where(Quotation.id == uuid.UUID(sample_quotation["id"]))
            .values(pdf_path="quotes/test.pdf", pdf_generated_at=func.now())
        )
        await db_session.execute(stmt)
        await db_session.commit()

        response = await client.get(
            f"/api/v1/quotes/{sample_quotation['id']}/pdf",
            headers=auth_headers,
        )
        assert response.status_code == 307
        location = response.headers.get("location")
        assert location == "https://minio.example.com/quotes/test.pdf"

    async def test_get_pdf_before_generation(
        self, client: AsyncClient, auth_headers: dict, sample_quotation: dict
    ):
        """Should return 404 if PDF not yet generated."""
        response = await client.get(
            f"/api/v1/quotes/{sample_quotation['id']}/pdf",
            headers=auth_headers,
        )
        assert response.status_code == 404

    async def test_get_pdf_requires_auth(
        self, client: AsyncClient, sample_quotation: dict
    ):
        """Should reject unauthenticated request."""
        response = await client.get(
            f"/api/v1/quotes/{sample_quotation['id']}/pdf"
        )
        assert response.status_code == 401


# ═══════════════════════════════════════════════════════════
# Tests: Finalize Quotation
# ═══════════════════════════════════════════════════════════


class TestFinalizeQuotation:
    """POST /api/v1/quotes/{id}/finalize"""

    @patch("app.modules.output.service.generate_quotation_pdf")
    async def test_finalize_success(
        self,
        mock_generate_pdf,
        client: AsyncClient,
        auth_headers: dict,
        sample_quotation: dict,
    ):
        """Should finalize a draft quotation and generate PDF."""
        mock_generate_pdf.return_value = {
            "pdf_path": "quotes/test.pdf",
            "pdf_url": "https://minio.example.com/quotes/test.pdf",
        }

        response = await client.post(
            f"/api/v1/quotes/{sample_quotation['id']}/finalize",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "finalized"
