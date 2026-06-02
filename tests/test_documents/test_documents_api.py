"""
AI-Sourcing Hub — Document Module Test Suite

Covers:
    - Document upload (POST /api/v1/documents/upload)
    - Document CRUD (GET, DELETE, LIST)
    - Status polling (GET /{id}/status)
    - Extracted items (GET /{id}/items, PUT /{id}/items)
    - JSON repair unit tests
    - Vision client unit tests
    - Authentication & authorization guards
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import json
import uuid
from typing import Any, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI

from app.modules.documents.json_repair import (
    repair_vision_json,
    _validate_result,
    _salvage_partial_data,
    repair_json,
)
from app.modules.documents.vision_client import (
    _get_retry_delay_with_jitter,
    _is_retryable_status,
    _is_provider_overloaded,
)
from app.modules.documents.models import Document, DocumentStatus, DocumentType
from app.modules.documents.schemas import (
    DocumentUploadResponse,
    DocumentResponse,
    DocumentStatusResponse,
    ItemsUpdateRequest,
    ItemsUpdateResponse,
)
from app.shared.database import get_db

pytestmark = pytest.mark.asyncio


# ═══════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════

SAMPLE_PRODUCT_ITEM = {
    "product_name": "高温法兰球阀",
    "model_number": "Q41F-16C",
    "unit_price_rmb": 850.0,
    "moq": 10,
    "weight_kg": 12.5,
    "dimensions": "DN50",
    "material": "WCB",
}

VALID_JSON_RESPONSE = json.dumps([SAMPLE_PRODUCT_ITEM])
MARKDOWN_FENCED_RESPONSE = f"```json\n{VALID_JSON_RESPONSE}\n```"
PARTIALLY_MALFORMED = """[
  {"product_name": "法兰球阀", "unit_price_rmb": 850, "model_number": "Q41F"},
  {"product_name": "闸阀", "unit_price_rmb": 1200, "moq": 5}
]"""
NON_JSON_RESPONSE = "This image shows a document with product information."


# ═══════════════════════════════════════════════════════════
# JSON Repair Unit Tests
# ═══════════════════════════════════════════════════════════


class TestRepairVisionJson:
    """Unit tests for ``repair_vision_json()``."""

    def test_valid_json(self):
        """Should return parsed list for clean JSON input."""
        result = repair_vision_json(VALID_JSON_RESPONSE)
        assert result is not None
        assert len(result) == 1
        assert result[0]["product_name"] == "高温法兰球阀"
        assert result[0]["unit_price_rmb"] == 850.0  # coerced to float

    def test_markdown_fenced_json(self):
        """Should strip ```json fences before parsing."""
        result = repair_vision_json(MARKDOWN_FENCED_RESPONSE)
        assert result is not None
        assert len(result) == 1
        assert result[0]["model_number"] == "Q41F-16C"

    def test_partially_malformed(self):
        """Should recover from minor JSON corruption."""
        result = repair_vision_json(PARTIALLY_MALFORMED)
        assert result is not None
        assert len(result) == 2

    def test_non_json_text_returns_none(self):
        """Should return None for completely non-JSON text."""
        result = repair_vision_json(NON_JSON_RESPONSE)
        assert result is None

    def test_empty_array(self):
        """Should return empty list for '[]'."""
        result = repair_vision_json("[]")
        assert result is not None
        assert result == []

    def test_numeric_coercion(self):
        """Should coerce unit_price_rmb→float, moq→int, weight_kg→float."""
        raw = json.dumps([
            {
                "product_name": "Test",
                "model_number": "T-1",
                "unit_price_rmb": "850",  # string → float
                "moq": "10",              # string → int
                "weight_kg": "12.5",      # string → float
            }
        ])
        result = repair_vision_json(raw)
        assert result is not None
        assert isinstance(result[0]["unit_price_rmb"], float)
        assert isinstance(result[0]["moq"], int)
        assert isinstance(result[0]["weight_kg"], float)

    def test_salvage_partial_data(self):
        """Should salvage partial data from garbled text."""
        garbled = (
            'Some preamble text...'
            '"product_name":"法兰球阀","unit_price_rmb":850,"model_number":"Q41F"'
            'more garbage'
            '"product_name":"闸阀","unit_price_rmb":1200,"model_number":"Z41H"'
        )
        result = _salvage_partial_data(garbled)
        assert result is not None
        assert len(result) == 2
        assert result[0]["product_name"] == "法兰球阀"

    def test_legacy_repair_json_wrapper(self):
        """Legacy ``repair_json()`` should return dict with products key."""
        result = repair_json(VALID_JSON_RESPONSE)
        assert result is not None
        assert "products" in result
        assert "confidence" in result
        assert isinstance(result["products"], list)
        assert result["confidence"] == 0.8


class TestValidateResult:
    """Unit tests for ``_validate_result()``."""

    def test_valid_list(self):
        """Should return validated list for valid input."""
        data = [{"product_name": "Test", "model_number": "T-1"}]
        result = _validate_result(data)
        assert result is not None
        assert len(result) == 1

    def test_empty_list(self):
        """Should return empty list for empty input."""
        result = _validate_result([])
        assert result is not None
        assert result == []

    def test_none_input(self):
        """Should return None for None input."""
        result = _validate_result(None)
        assert result is None

    def test_not_a_list(self):
        """Should return None for non-list input."""
        result = _validate_result("not a list")
        assert result is None

    def test_missing_required_fields(self):
        """Should filter out items without product_name or model_number."""
        data = [
            {"product_name": "Valid Product"},  # has product_name
            {"some_other_field": "No identifier"},  # no product_name or model_number
        ]
        result = _validate_result(data)
        assert result is not None
        assert len(result) == 1
        assert result[0]["product_name"] == "Valid Product"


# ═══════════════════════════════════════════════════════════
# Vision Client Unit Tests
# ═══════════════════════════════════════════════════════════


class TestRetryDelay:
    """Unit tests for ``_get_retry_delay_with_jitter()``."""

    def test_exponential_backoff(self):
        """Delay should increase exponentially with attempt number."""
        delays = [_get_retry_delay_with_jitter(i) for i in range(4)]
        # Each delay should grow (base * 2^attempt with jitter)
        for i in range(1, len(delays)):
            assert delays[i] >= delays[i - 1] * 0.5  # allow for jitter

    def test_capped_at_max(self):
        """Delay should not exceed RETRY_MAX_DELAY (60s)."""
        delay = _get_retry_delay_with_jitter(10)
        assert delay <= 60.0

    def test_always_positive(self):
        """Delay should always be positive."""
        for attempt in range(5):
            assert _get_retry_delay_with_jitter(attempt) > 0


class TestRetryableStatus:
    """Unit tests for ``_is_retryable_status()`` and ``_is_provider_overloaded()``."""

    def test_429_is_retryable(self):
        assert _is_retryable_status(429) is True

    def test_502_is_retryable(self):
        assert _is_retryable_status(502) is True

    def test_503_is_retryable(self):
        assert _is_retryable_status(503) is True

    def test_504_is_retryable(self):
        assert _is_retryable_status(504) is True

    def test_200_not_retryable(self):
        assert _is_retryable_status(200) is False

    def test_400_not_retryable(self):
        assert _is_retryable_status(400) is False

    def test_503_is_overloaded(self):
        assert _is_provider_overloaded(503) is True

    def test_429_not_overloaded(self):
        assert _is_provider_overloaded(429) is False

    def test_502_not_overloaded(self):
        assert _is_provider_overloaded(502) is False


# ═══════════════════════════════════════════════════════════
# API Fixtures
# ═══════════════════════════════════════════════════════════


@pytest.fixture
def app(db_session):
    """Create app with overridden DB dependency."""
    from app.main import create_app

    application = create_app()
    application.dependency_overrides = {}

    async def _get_db_override():
        yield db_session

    application.dependency_overrides[get_db] = _get_db_override
    return application


@pytest.fixture
async def client(app) -> AsyncClient:
    """Create async test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def auth_headers(client: AsyncClient, db_session) -> dict:
    """Register a user and return auth headers."""
    register_payload = {
        "email": f"doc-test-{uuid.uuid4().hex[:8]}@example.com",
        "password": "ValidPass123!",
        "full_name": "Doc Tester",
        "role": "agent",
    }
    resp = await client.post("/api/v1/auth/register", json=register_payload)
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def admin_headers(client: AsyncClient, db_session) -> dict:
    """Register an admin user and return auth headers."""
    register_payload = {
        "email": f"doc-admin-{uuid.uuid4().hex[:8]}@example.com",
        "password": "AdminPass123!",
        "full_name": "Doc Admin",
        "role": "admin",
    }
    resp = await client.post("/api/v1/auth/register", json=register_payload)
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def sample_rfq(client: AsyncClient, auth_headers: dict) -> dict:
    """Create a sample RFQ for document upload tests."""
    payload = {
        "supplier_name": "测试供应商",
        "contact_email": "supplier@test.com",
        "source_language": "Arabic",
    }
    resp = await client.post(
        "/api/v1/intake/rfqs",
        json=payload,
        headers=auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()


# ═══════════════════════════════════════════════════════════
# Upload Tests
# ═══════════════════════════════════════════════════════════


class TestUploadDocument:
    """POST /api/v1/documents/upload"""

    async def _upload_test_file(
        self,
        client: AsyncClient,
        rfq_id: str,
        headers: dict,
        file_bytes: bytes = b"fake-image-data",
        filename: str = "test_catalogue.png",
        content_type: str = "image/png",
    ) -> dict:
        """Helper to upload a test file."""
        resp = await client.post(
            "/api/v1/documents/upload",
            data={"rfq_id": rfq_id},
            files={"file": (filename, file_bytes, content_type)},
            headers=headers,
        )
        return resp

    @patch("app.modules.documents.service.storage_client.upload_file")
    async def test_upload_image_success(
        self,
        mock_upload,
        client: AsyncClient,
        auth_headers: dict,
        sample_rfq: dict,
    ):
        """Upload valid image → 201 with document details."""
        mock_upload.return_value = None
        resp = await self._upload_test_file(client, sample_rfq["id"], auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "uploaded"
        assert data["file_name"] == "test_catalogue.png"
        assert data["file_size_bytes"] == len(b"fake-image-data")
        assert "id" in data

    @patch("app.modules.documents.service.storage_client.upload_file")
    async def test_upload_requires_auth(
        self,
        mock_upload,
        client: AsyncClient,
        sample_rfq: dict,
    ):
        """Upload without auth → 401."""
        resp = await self._upload_test_file(client, sample_rfq["id"], {})
        assert resp.status_code == 401

    @patch("app.modules.documents.service.storage_client.upload_file")
    async def test_upload_requires_agent_or_admin(
        self,
        mock_upload,
        client: AsyncClient,
        db_session,
    ):
        """Upload as regular user (viewer role) → 403."""
        # Register a viewer user
        register_payload = {
            "email": f"viewer-{uuid.uuid4().hex[:8]}@example.com",
            "password": "ViewerPass123!",
            "full_name": "Viewer User",
            "role": "viewer",
        }
        resp = await client.post("/api/v1/auth/register", json=register_payload)
        assert resp.status_code == 201
        viewer_token = resp.json()["access_token"]
        viewer_headers = {"Authorization": f"Bearer {viewer_token}"}

        # Create RFQ as admin
        admin_payload = {
            "email": f"admin-{uuid.uuid4().hex[:8]}@example.com",
            "password": "AdminPass123!",
            "full_name": "Admin",
            "role": "admin",
        }
        resp = await client.post("/api/v1/auth/register", json=admin_payload)
        assert resp.status_code == 201
        admin_token = resp.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        rfq_resp = await client.post(
            "/api/v1/intake/rfqs",
            json={"supplier_name": "Test", "source_language": "Arabic"},
            headers=admin_headers,
        )
        assert rfq_resp.status_code == 201
        rfq_id = rfq_resp.json()["id"]

        # Now try uploading as viewer
        resp = await self._upload_test_file(client, rfq_id, viewer_headers)
        assert resp.status_code == 403

    @patch("app.modules.documents.service.storage_client.upload_file")
    async def test_upload_storage_failure(
        self,
        mock_upload,
        client: AsyncClient,
        auth_headers: dict,
        sample_rfq: dict,
    ):
        """Storage failure → 500 level error."""
        mock_upload.side_effect = Exception("MinIO connection refused")
        resp = await self._upload_test_file(client, sample_rfq["id"], auth_headers)
        assert resp.status_code >= 500


# ═══════════════════════════════════════════════════════════
# Status Polling Tests
# ═══════════════════════════════════════════════════════════


class TestDocumentStatus:
    """GET /api/v1/documents/{id}/status"""

    @patch("app.modules.documents.service.storage_client.upload_file")
    async def test_status_uploaded(
        self,
        mock_upload,
        client: AsyncClient,
        auth_headers: dict,
        sample_rfq: dict,
    ):
        """Newly uploaded document should have status ``uploaded``."""
        mock_upload.return_value = None
        upload_resp = await client.post(
            "/api/v1/documents/upload",
            data={"rfq_id": sample_rfq["id"]},
            files={"file": ("test.png", b"data", "image/png")},
            headers=auth_headers,
        )
        doc_id = upload_resp.json()["id"]

        status_resp = await client.get(
            f"/api/v1/documents/{doc_id}/status",
            headers=auth_headers,
        )
        assert status_resp.status_code == 200
        data = status_resp.json()
        assert data["status"] == "uploaded"
        assert data["id"] == doc_id

    @patch("app.modules.documents.service.storage_client.upload_file")
    async def test_status_requires_auth(
        self,
        mock_upload,
        client: AsyncClient,
        auth_headers: dict,
        sample_rfq: dict,
    ):
        """Status endpoint requires authentication."""
        mock_upload.return_value = None
        upload_resp = await client.post(
            "/api/v1/documents/upload",
            data={"rfq_id": sample_rfq["id"]},
            files={"file": ("test.png", b"data", "image/png")},
            headers=auth_headers,
        )
        doc_id = upload_resp.json()["id"]

        resp = await client.get(f"/api/v1/documents/{doc_id}/status")
        assert resp.status_code == 401


# ═══════════════════════════════════════════════════════════
# Items Tests
# ═══════════════════════════════════════════════════════════


class TestDocumentItems:
    """GET/PUT /api/v1/documents/{id}/items"""

    @patch("app.modules.documents.service.storage_client.upload_file")
    async def test_get_items_empty_on_upload(
        self,
        mock_upload,
        client: AsyncClient,
        auth_headers: dict,
        sample_rfq: dict,
    ):
        """Unprocessed document should return empty items list."""
        mock_upload.return_value = None
        upload_resp = await client.post(
            "/api/v1/documents/upload",
            data={"rfq_id": sample_rfq["id"]},
            files={"file": ("test.png", b"data", "image/png")},
            headers=auth_headers,
        )
        doc_id = upload_resp.json()["id"]

        resp = await client.get(
            f"/api/v1/documents/{doc_id}/items",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["total"] == 0

    @patch("app.modules.documents.service.storage_client.upload_file")
    async def test_put_items_overrides(
        self,
        mock_upload,
        client: AsyncClient,
        auth_headers: dict,
        sample_rfq: dict,
    ):
        """PUT items should override extracted data."""
        mock_upload.return_value = None
        upload_resp = await client.post(
            "/api/v1/documents/upload",
            data={"rfq_id": sample_rfq["id"]},
            files={"file": ("test.png", b"data", "image/png")},
            headers=auth_headers,
        )
        doc_id = upload_resp.json()["id"]

        # Override items
        items_payload = {"items": [SAMPLE_PRODUCT_ITEM]}
        put_resp = await client.put(
            f"/api/v1/documents/{doc_id}/items",
            json=items_payload,
            headers=auth_headers,
        )
        assert put_resp.status_code == 200
        put_data = put_resp.json()
        assert put_data["status"] == "extracted"
        assert "extracted_entities" in put_data

        # Verify items were stored
        get_resp = await client.get(
            f"/api/v1/documents/{doc_id}/items",
            headers=auth_headers,
        )
        assert get_resp.status_code == 200
        get_data = get_resp.json()
        assert get_data["total"] == 1
        assert get_data["items"][0]["product_name"] == SAMPLE_PRODUCT_ITEM["product_name"]

    @patch("app.modules.documents.service.storage_client.upload_file")
    async def test_put_items_requires_agent_or_admin(
        self,
        mock_upload,
        client: AsyncClient,
        auth_headers: dict,
        sample_rfq: dict,
    ):
        """PUT items requires agent or admin role."""
        mock_upload.return_value = None
        upload_resp = await client.post(
            "/api/v1/documents/upload",
            data={"rfq_id": sample_rfq["id"]},
            files={"file": ("test.png", b"data", "image/png")},
            headers=auth_headers,
        )
        doc_id = upload_resp.json()["id"]

        # Register viewer user
        viewer_payload = {
            "email": f"viewer2-{uuid.uuid4().hex[:8]}@example.com",
            "password": "ViewerPass123!",
            "full_name": "Viewer",
            "role": "viewer",
        }
        resp = await client.post("/api/v1/auth/register", json=viewer_payload)
        assert resp.status_code == 201
        viewer_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

        # Viewer should not be able to override items
        put_resp = await client.put(
            f"/api/v1/documents/{doc_id}/items",
            json={"items": [SAMPLE_PRODUCT_ITEM]},
            headers=viewer_headers,
        )
        assert put_resp.status_code == 403


# ═══════════════════════════════════════════════════════════
# Document CRUD Tests
# ═══════════════════════════════════════════════════════════


class TestGetDocument:
    """GET /api/v1/documents/{id}"""

    @patch("app.modules.documents.service.storage_client.upload_file")
    async def test_get_document_success(
        self,
        mock_upload,
        client: AsyncClient,
        auth_headers: dict,
        sample_rfq: dict,
    ):
        """Should return full document details."""
        mock_upload.return_value = None
        upload_resp = await client.post(
            "/api/v1/documents/upload",
            data={"rfq_id": sample_rfq["id"]},
            files={"file": ("test.png", b"data", "image/png")},
            headers=auth_headers,
        )
        doc_id = upload_resp.json()["id"]

        resp = await client.get(
            f"/api/v1/documents/{doc_id}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == doc_id
        assert data["file_name"] == "test.png"
        assert data["status"] == "uploaded"

    async def test_get_document_not_found(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        """Non-existent document → 404."""
        fake_id = str(uuid.uuid4())
        resp = await client.get(
            f"/api/v1/documents/{fake_id}",
            headers=auth_headers,
        )
        assert resp.status_code == 404


class TestListDocuments:
    """GET /api/v1/documents/rfq/{rfq_id}"""

    @patch("app.modules.documents.service.storage_client.upload_file")
    async def test_list_documents(
        self,
        mock_upload,
        client: AsyncClient,
        auth_headers: dict,
        sample_rfq: dict,
    ):
        """Should list all documents for an RFQ."""
        mock_upload.return_value = None
        # Upload two documents
        for name in ["doc1.png", "doc2.png"]:
            await client.post(
                "/api/v1/documents/upload",
                data={"rfq_id": sample_rfq["id"]},
                files={"file": (name, b"data", "image/png")},
                headers=auth_headers,
            )

        resp = await client.get(
            f"/api/v1/documents/rfq/{sample_rfq['id']}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

    async def test_list_documents_requires_auth(
        self,
        client: AsyncClient,
        sample_rfq: dict,
    ):
        """List requires authentication."""
        resp = await client.get(
            f"/api/v1/documents/rfq/{sample_rfq['id']}",
        )
        assert resp.status_code == 401


class TestDeleteDocument:
    """DELETE /api/v1/documents/{id}"""

    @patch("app.modules.documents.service.storage_client.upload_file")
    @patch("app.modules.documents.service.storage_client.delete_file")
    async def test_delete_document_success(
        self,
        mock_delete,
        mock_upload,
        client: AsyncClient,
        auth_headers: dict,
        sample_rfq: dict,
    ):
        """Delete existing document → 204."""
        mock_upload.return_value = None
        mock_delete.return_value = None

        upload_resp = await client.post(
            "/api/v1/documents/upload",
            data={"rfq_id": sample_rfq["id"]},
            files={"file": ("test.png", b"data", "image/png")},
            headers=auth_headers,
        )
        doc_id = upload_resp.json()["id"]

        resp = await client.delete(
            f"/api/v1/documents/{doc_id}",
            headers=auth_headers,
        )
        assert resp.status_code == 204

        # Verify it's gone
        get_resp = await client.get(
            f"/api/v1/documents/{doc_id}",
            headers=auth_headers,
        )
        assert get_resp.status_code == 404

    @patch("app.modules.documents.service.storage_client.upload_file")
    async def test_delete_requires_agent_or_admin(
        self,
        mock_upload,
        client: AsyncClient,
        auth_headers: dict,
        sample_rfq: dict,
    ):
        """Delete requires agent or admin role."""
        mock_upload.return_value = None
        upload_resp = await client.post(
            "/api/v1/documents/upload",
            data={"rfq_id": sample_rfq["id"]},
            files={"file": ("test.png", b"data", "image/png")},
            headers=auth_headers,
        )
        doc_id = upload_resp.json()["id"]

        # Register viewer
        viewer_payload = {
            "email": f"viewer3-{uuid.uuid4().hex[:8]}@example.com",
            "password": "ViewerPass123!",
            "full_name": "Viewer",
            "role": "viewer",
        }
        resp = await client.post("/api/v1/auth/register", json=viewer_payload)
        assert resp.status_code == 201
        viewer_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

        resp = await client.delete(
            f"/api/v1/documents/{doc_id}",
            headers=viewer_headers,
        )
        assert resp.status_code == 403
