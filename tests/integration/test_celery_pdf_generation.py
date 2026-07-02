"""
AI-Sourcing Hub — Async Quotation PDF Generation (Celery) Tests

Exercises the real ``generate_quotation_pdf_task`` Celery task end-to-end
(real Jinja2 rendering, real WeasyPrint PDF generation, real upload via
moto's in-process S3 mock) — not a mock of the task's internals.

The task's own ``_get_sync_session()``/``_get_sync_engine()``
(app/modules/output/tasks.py:32-48) derives its DB URL from
``settings.db_url``, which — per TESTING_FINDINGS.md #3b — never picks up
this suite's SQLite test override due to a conftest.py import-order issue,
so it always tries to connect to a real Postgres host. Rather than duplicate
that finding, this file monkeypatches `_get_sync_session` to point at a
freshly-created sync SQLite engine (schema created the same
table-at-a-time way as the async `db_engine` fixture, for the same
CatalogProduct-trigger-DDL reason — see TESTING_FINDINGS.md #1b) — this is
the one piece of DB plumbing the task needs replaced; everything else
(rendering, PDF bytes, upload) is the real implementation.
"""
import uuid
from datetime import datetime, timezone

import pytest
from moto import mock_aws
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.modules.output.tasks as tasks_module
import app.shared.storage as storage
from app.shared.database import Base

QUOTES_BUCKET = "test-quotes-bucket"


@pytest.fixture
def sync_sqlite_session(monkeypatch):
    """A real sync SQLite session, schema created, wired in place of the
    task's broken `_get_sync_session()`."""
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool,
    )
    for table in Base.metadata.sorted_tables:
        try:
            Base.metadata.create_all(engine, tables=[table])
        except Exception:
            pass  # CatalogProduct's PostgreSQL-only trigger DDL — see TESTING_FINDINGS.md #1b

    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()

    monkeypatch.setattr(tasks_module, "_get_sync_session", lambda: session)

    yield session
    session.close()


@pytest.fixture(autouse=True)
def _plain_s3_client_for_moto(monkeypatch):
    """See tests/integration/test_documents_pipeline.py — same reasoning."""
    import boto3

    monkeypatch.setattr(storage, "_get_s3_client", lambda: boto3.client("s3", region_name="us-east-1"))


def _make_quotation_row(session) -> "tuple[uuid.UUID, uuid.UUID]":
    """Insert a minimal RFQ + Quotation + QuotationLineItem via the sync
    session (mirrors the async factories in conftest.py, but synchronous)."""
    from app.modules.auth.models import User, UserRole
    from app.modules.intake.models import RFQ, RFQStatus
    from app.modules.output.models import Quotation, QuotationStatus
    from app.modules.pricing.models import QuotationLineItem

    agent = User(
        id=uuid.uuid4(), email=f"agent_{uuid.uuid4().hex[:8]}@example.com",
        password_hash="x", full_name="Agent", role=UserRole.AGENT, is_active=True,
    )
    session.add(agent)
    session.flush()

    rfq = RFQ(
        id=uuid.uuid4(), agent_id=agent.id, client_name="Test Client",
        client_phone="+962700000000", destination_port="Aqaba",
        target_currency="JOD", status=RFQStatus.QUOTED, is_public=False,
    )
    session.add(rfq)
    session.flush()

    quotation = Quotation(
        id=uuid.uuid4(), rfq_id=rfq.id, agent_id=agent.id,
        quotation_number=f"Q-TEST-{uuid.uuid4().hex[:6].upper()}",
        status=QuotationStatus.FINALIZED, target_currency="JOD",
        exchange_rate_used=0.1047, subtotal=1000.0, grand_total=1150.0,
        created_at=datetime.now(timezone.utc),
    )
    session.add(quotation)
    session.flush()

    line_item = QuotationLineItem(
        id=uuid.uuid4(), quotation_id=quotation.id, product_name="Industrial LED Floodlight",
        quantity=100, unit_price_cny=50.0, unit_price_converted=5.0,
        exchange_rate_used=0.1047, subtotal=500.0, total=575.0,
    )
    session.add(line_item)
    session.commit()

    return quotation.id


class TestGenerateQuotationPdfTask:
    def test_task_generates_pdf_and_uploads_it(self, sync_sqlite_session, monkeypatch):
        from app.config import settings

        monkeypatch.setattr(settings, "STORAGE_BUCKET_QUOTES", QUOTES_BUCKET)
        quotation_id = _make_quotation_row(sync_sqlite_session)

        with mock_aws():
            import asyncio

            asyncio.run(storage.ensure_bucket(QUOTES_BUCKET))

            result = tasks_module.generate_quotation_pdf_task.apply(
                args=(str(quotation_id),),
            ).get()

            assert result["status"] == "generated"
            assert result["pdf_path"]

            downloaded = asyncio.run(
                storage.download_file(key=result["pdf_path"], bucket=QUOTES_BUCKET)
            )
        assert downloaded is not None
        assert downloaded.startswith(b"%PDF")

    def test_task_updates_quotation_pdf_fields(self, sync_sqlite_session, monkeypatch):
        from app.config import settings
        from app.modules.output.models import Quotation

        monkeypatch.setattr(settings, "STORAGE_BUCKET_QUOTES", QUOTES_BUCKET)
        quotation_id = _make_quotation_row(sync_sqlite_session)

        with mock_aws():
            import asyncio

            asyncio.run(storage.ensure_bucket(QUOTES_BUCKET))
            tasks_module.generate_quotation_pdf_task.apply(args=(str(quotation_id),)).get()

        updated = sync_sqlite_session.query(Quotation).filter(Quotation.id == quotation_id).first()
        assert updated.pdf_path is not None
        assert updated.pdf_generated_at is not None

    def test_task_returns_failed_status_for_missing_quotation(self, sync_sqlite_session):
        fake_id = str(uuid.uuid4())
        result = tasks_module.generate_quotation_pdf_task.apply(args=(fake_id,)).get()
        assert result["status"] == "failed"
        assert result["error"] == "not_found"
