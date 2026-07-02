"""
AI-Sourcing Hub — Document Upload -> OCR -> Extracted Items Pipeline

``tests/test_documents/test_documents_api.py`` always mocks
``storage_client.upload_file`` directly, so no test has ever exercised a real
upload/download round trip or real (non-OCR) text extraction. This file
covers the gap using real building blocks instead of Docker/MinIO (which
isn't available in this sandbox — see TESTING_FINDINGS.md):

  1. ``moto``'s in-process S3 mock intercepts boto3 calls at the HTTP layer,
     so ``app.shared.storage.upload_file``/``download_file``/``ensure_bucket``
     run their real logic against a genuine (if in-memory) S3-compatible
     bucket — not a mocked-out function.
  2. A real single-page PDF, generated on the fly via WeasyPrint (already a
     hard dependency of this project for quote PDFs), gives
     ``ocr_client._pdf_to_text()`` (pypdfium2) actual embedded text to
     extract — no PaddleOCR/LLM network calls involved for this path.
  3. ``sync_document_products()`` (the async twin of the sync version the
     real Celery task calls, same logic) is exercised directly against the
     test DB session, since the Celery task wrapper itself can't run here at
     all — see TESTING_FINDINGS.md #3b/#3c (its sync DB session always
     resolves to a real ``postgres`` host, same root cause documented for
     ``expire_stale_matches_task``).

Discovered while writing this file: ``pypdfium2`` (the primary/fast PDF text
path `ocr_client.py` relies on) isn't listed in `requirements.txt` or
`pyproject.toml` main dependencies at all — see TESTING_FINDINGS.md.
"""
import uuid

import pytest
from moto import mock_aws
from weasyprint import HTML

import app.shared.storage as storage
from app.modules.documents.ocr_client import _pdf_to_text
from app.shared.storage import download_file, ensure_bucket, upload_file

TEST_BUCKET = "test-documents-bucket"


@pytest.fixture(autouse=True)
def _plain_s3_client_for_moto(monkeypatch):
    """``_get_s3_client()`` normally points at ``settings.s3_endpoint_url``
    (a MinIO-shaped ``http://minio:9000``). moto's ``mock_aws()`` intercepts
    requests to AWS-shaped endpoints; a custom non-AWS endpoint_url bypasses
    that interception and boto3 tries a real DNS lookup for "minio", which
    fails outside docker-compose. Point the client at plain AWS S3 (which
    moto does intercept) for this test module only."""
    import boto3

    def _plain_client():
        return boto3.client("s3", region_name="us-east-1")

    monkeypatch.setattr(storage, "_get_s3_client", _plain_client)


def _make_catalog_pdf_bytes() -> bytes:
    html = """
    <html><body>
      <table>
        <tr><td>产品名称</td><td>型号</td><td>单价</td></tr>
        <tr><td>工业LED投光灯</td><td>LED-FL-100W</td><td>45.00</td></tr>
      </table>
    </body></html>
    """
    return HTML(string=html).write_pdf()


@pytest.mark.asyncio
class TestRealUploadDownloadRoundTrip:
    """Exercises the actual boto3 client code path via moto's S3 mock."""

    async def test_upload_then_download_returns_identical_bytes(self):
        with mock_aws():
            await ensure_bucket(TEST_BUCKET)
            pdf_bytes = _make_catalog_pdf_bytes()
            key = f"documents/{uuid.uuid4()}/catalogue.pdf"

            returned_key = await upload_file(
                pdf_bytes, key=key, content_type="application/pdf", bucket=TEST_BUCKET,
            )
            assert returned_key == key

            downloaded = await download_file(key=key, bucket=TEST_BUCKET)
            assert downloaded == pdf_bytes

    async def test_download_missing_key_returns_none(self):
        with mock_aws():
            await ensure_bucket(TEST_BUCKET)
            result = await download_file(key="documents/does-not-exist.pdf", bucket=TEST_BUCKET)
            assert result is None

    async def test_ensure_bucket_is_idempotent(self):
        with mock_aws():
            first = await ensure_bucket(TEST_BUCKET)
            second = await ensure_bucket(TEST_BUCKET)
            assert first is True
            assert second is True


@pytest.mark.asyncio
class TestRealPdfTextExtraction:
    """A genuinely generated PDF, no OCR/LLM involved for this text layer."""

    async def test_pdf_with_embedded_text_extracted_without_ocr(self):
        pdf_bytes = _make_catalog_pdf_bytes()
        text = _pdf_to_text(pdf_bytes)
        assert "工业LED投光灯" in text
        assert "45.00" in text

    async def test_full_upload_to_extraction_pipeline(self):
        """Upload a real PDF to (mocked) S3, download it back, and extract
        its text — end-to-end minus the LLM structuring call."""
        with mock_aws():
            await ensure_bucket(TEST_BUCKET)
            pdf_bytes = _make_catalog_pdf_bytes()
            key = f"documents/{uuid.uuid4()}/catalogue.pdf"
            await upload_file(pdf_bytes, key=key, content_type="application/pdf", bucket=TEST_BUCKET)

            downloaded = await download_file(key=key, bucket=TEST_BUCKET)
            text = _pdf_to_text(downloaded)

        assert "工业LED投光灯" in text


@pytest.mark.asyncio
class TestSyncDocumentProductsToCatalog:
    """sync_document_products() — the catalog-write step the Celery task's
    sync twin performs after extraction, tested directly against the async
    test DB session (bypassing the broken create_sync_session_factory() the
    real Celery task uses, per TESTING_FINDINGS.md #3b/#3c)."""

    async def test_extracted_products_synced_to_catalog_for_agent_uploader(
        self, db_session, make_document, make_user,
    ):
        from sqlalchemy import select

        from app.modules.catalog.models import CatalogProduct
        from app.modules.catalog.service import sync_document_products
        from app.modules.documents.models import DocumentStatus

        supplier = await make_user(role="agent")
        document = await make_document(
            uploaded_by=supplier,
            status=DocumentStatus.EXTRACTED,
            extracted_entities={
                "products": [
                    {"product_name": "工业LED投光灯", "model_number": "LED-FL-100W", "unit_price_rmb": 45.0},
                ]
            },
        )
        await db_session.refresh(document, attribute_names=["uploaded_by"])

        count = await sync_document_products(db_session, document)
        assert count == 1

        result = await db_session.execute(
            select(CatalogProduct).where(CatalogProduct.document_id == document.id)
        )
        products = result.scalars().all()
        assert len(products) == 1
        assert products[0].product_name == "工业LED投光灯"

    async def test_non_agent_uploader_products_are_not_synced(
        self, db_session, make_document, make_user,
    ):
        from app.modules.catalog.service import sync_document_products
        from app.modules.documents.models import DocumentStatus

        client_user = await make_user(role="client")
        document = await make_document(
            uploaded_by=client_user,
            status=DocumentStatus.EXTRACTED,
            extracted_entities={"products": [{"product_name": "Something"}]},
        )
        await db_session.refresh(document, attribute_names=["uploaded_by"])

        count = await sync_document_products(db_session, document)
        assert count == 0

    async def test_no_products_extracted_syncs_nothing(self, db_session, make_document, make_user):
        from app.modules.catalog.service import sync_document_products
        from app.modules.documents.models import DocumentStatus

        supplier = await make_user(role="agent")
        document = await make_document(
            uploaded_by=supplier, status=DocumentStatus.EXTRACTED, extracted_entities={"products": []},
        )
        await db_session.refresh(document, attribute_names=["uploaded_by"])

        count = await sync_document_products(db_session, document)
        assert count == 0
