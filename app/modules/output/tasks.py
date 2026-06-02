"""
AI-Sourcing Hub — Output (Quotation) Celery Tasks

Background tasks for PDF generation and quotation management.

Task discovery is handled by ``celery_app.autodiscover_tasks()``
with ``related_name="tasks"``, which picks up all ``@celery_app.task``
decorated functions in this module.
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.shared.celery_app import celery_app
from app.shared.logging import get_logger

logger = get_logger(__name__)


# ═══════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════

def _get_sync_engine():
    """Create a sync SQLAlchemy engine (Celery tasks run synchronously).

    Replaces ``postgresql+asyncpg`` with ``postgresql+psycopg2``
    since Celery workers cannot use async drivers.
    """
    sync_url = settings.db_url.replace(
        "postgresql+asyncpg", "postgresql+psycopg2"
    )
    return create_engine(sync_url, pool_pre_ping=True)


def _get_sync_session() -> Session:
    """Get a sync DB session for Celery task use."""
    engine = _get_sync_engine()
    SessionLocal = sessionmaker(bind=engine)
    return SessionLocal()


def _generate_quotation_number() -> str:
    """Generate a unique quotation number (sync version).

    Format: Q-YYYYMMDD-XXXX (e.g., Q-20260602-0001)
    """
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    unique_id = str(uuid.uuid4()).split("-")[0].upper()[:4]
    return f"Q-{today}-{unique_id}"


# ═══════════════════════════════════════════════════════════
# Tasks
# ═══════════════════════════════════════════════════════════

@celery_app.task(
    bind=True,
    name="generate-quotation-pdf",
    acks_late=True,
    max_retries=3,
    default_retry_delay=30,
)
def generate_quotation_pdf_task(self, quotation_id: str) -> dict:
    """Generate PDF for a quotation asynchronously.

    This task is enqueued by ``POST /api/v1/quotes/generate`` and runs
    in a Celery worker. It performs the full PDF generation pipeline:

    1. Creates a sync DB session.
    2. Fetches Quotation, RFQ, and line item records.
    3. Renders the Jinja2 HTML template with quotation data.
    4. Generates a PDF via WeasyPrint.
    5. Uploads the PDF to MinIO (``aisourcing-quotes`` bucket).
    6. Updates the Quotation record with ``pdf_path`` and ``pdf_generated_at``.

    Args:
        quotation_id: UUID of the Quotation record.

    Returns:
        Dict with status, pdf_path, and pdf_url.

    Raises:
        self.retry(): On transient failures (DB, MinIO, WeasyPrint).
    """
    logger.info(
        "Starting async PDF generation",
        extra={"quotation_id": quotation_id},
    )

    db: Optional[Session] = None
    try:
        db = _get_sync_session()

        # ---- Fetch quotation ----
        from app.modules.output.models import Quotation

        quotation = db.query(Quotation).filter(
            Quotation.id == uuid.UUID(quotation_id)
        ).first()

        if not quotation:
            logger.error(
                "Quotation not found for PDF generation",
                extra={"quotation_id": quotation_id},
            )
            return {"quotation_id": quotation_id, "status": "failed", "error": "not_found"}

        # ---- Fetch RFQ ----
        from app.modules.intake.models import RFQ

        rfq = db.query(RFQ).filter(
            RFQ.id == quotation.rfq_id
        ).first()

        # ---- Fetch line items ----
        from app.modules.pricing.models import QuotationLineItem

        line_items = (
            db.query(QuotationLineItem)
            .filter(QuotationLineItem.quotation_id == quotation.id)
            .order_by(QuotationLineItem.created_at.asc())
            .all()
        )

        # ---- Render HTML ----
        from jinja2 import Environment, FileSystemLoader

        template_dir = os.path.join(
            os.path.dirname(__file__), "templates"
        )
        env = Environment(loader=FileSystemLoader(template_dir))
        template = env.get_template("quotation.html")

        valid_until = datetime.now(timezone.utc) + timedelta(
            days=quotation.validity_days or 30
        )

        # Check for bundled font files
        font_path = os.path.join(
            template_dir, "..", "..", "..", "static", "fonts", "NotoSansArabic-Regular.ttf"
        )
        font_bold_path = os.path.join(
            template_dir, "..", "..", "..", "static", "fonts", "NotoSansArabic-Bold.ttf"
        )
        if not os.path.exists(font_path):
            font_path = ""
        if not os.path.exists(font_bold_path):
            font_bold_path = ""

        html = template.render(
            quotation_number=quotation.quotation_number,
            status=quotation.status.value,
            created_at=quotation.created_at.strftime("%Y-%m-%d") if quotation.created_at else "",
            valid_until=valid_until.strftime("%Y-%m-%d"),
            target_currency=quotation.target_currency,
            exchange_rate=quotation.exchange_rate_used,
            client_name=rfq.client_name if rfq else "",
            client_phone=rfq.client_phone if rfq else "",
            destination_port=rfq.destination_port if rfq else "",
            line_items=[
                {
                    "product_name": item.product_name,
                    "quantity": item.quantity,
                    "unit_price_cny": item.unit_price_cny,
                    "unit_price_converted": item.unit_price_converted,
                    "freight_cost": item.freight_cost or 0.0,
                    "customs_duty": item.customs_duty or 0.0,
                    "commission": item.commission or 0.0,
                    "discount": item.discount or 0.0,
                    "total": item.total,
                }
                for item in line_items
            ],
            show_details=True,
            subtotal=quotation.subtotal,
            freight_total=quotation.freight_total or 0.0,
            customs_total=quotation.customs_total or 0.0,
            commission_total=quotation.commission_total or 0.0,
            discount_total=quotation.discount_total or 0.0,
            vat_total=quotation.vat_total or 0.0,
            grand_total=quotation.grand_total,
            payment_terms=quotation.payment_terms or "",
            delivery_terms=quotation.delivery_terms or "",
            validity_days=quotation.validity_days or 30,
            notes=quotation.notes or "",
            css_path=os.path.join(template_dir, "styles.css"),
            font_path=font_path,
            font_bold_path=font_bold_path,
            logo_path=None,
            bank_name="",
            bank_beneficiary="",
            bank_iban="",
            bank_swift="",
            year=datetime.now(timezone.utc).year,
        )

        # ---- Generate PDF with WeasyPrint ----
        from weasyprint import HTML

        pdf_bytes = HTML(string=html).write_pdf()

        # ---- Upload to MinIO ----
        from app.shared.storage import storage_client

        pdf_key = f"{quotation.rfq_id}/{quotation.id}/quotation_{quotation.quotation_number}.pdf"

        import asyncio
        asyncio.run(
            storage_client.upload_file(
                file_bytes=pdf_bytes,
                key=pdf_key,
                content_type="application/pdf",
                bucket=settings.STORAGE_BUCKET_QUOTES,
            )
        )

        # ---- Generate presigned URL ----
        pdf_url = asyncio.run(
            storage_client.get_presigned_url(
                key=pdf_key,
                bucket=settings.STORAGE_BUCKET_QUOTES,
                expiry=3600,
            )
        )

        # ---- Update quotation record ----
        quotation.pdf_path = pdf_key
        quotation.pdf_generated_at = datetime.now(timezone.utc)
        db.flush()
        db.commit()

        logger.info(
            "PDF generated and uploaded successfully",
            extra={
                "quotation_id": quotation_id,
                "pdf_path": pdf_key,
            },
        )

        return {
            "quotation_id": quotation_id,
            "status": "generated",
            "pdf_path": pdf_key,
            "pdf_url": pdf_url,
        }

    except Exception as exc:
        logger.error(
            "PDF generation failed",
            extra={"quotation_id": quotation_id, "error": str(exc)},
        )
        if db:
            db.rollback()
        raise self.retry(exc=exc)

    finally:
        if db:
            db.close()


@celery_app.task(
    bind=True,
    name="cleanup-expired-quotes",
    acks_late=True,
    max_retries=2,
    default_retry_delay=60,
)
def cleanup_expired_quotes_task(self) -> dict:
    """Mark quotations older than 30 days as expired.

    Runs daily at midnight via Celery Beat (configured in
    ``app/shared/celery_app.py`` beat_schedule).

    Returns:
        Dict with status and count of expired quotations.
    """
    logger.info("Starting cleanup of expired quotations")

    db: Optional[Session] = None
    try:
        db = _get_sync_session()
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)

        from app.modules.output.models import Quotation, QuotationStatus

        result = (
            db.query(Quotation)
            .filter(
                Quotation.status.in_([
                    QuotationStatus.DRAFT,
                    QuotationStatus.FINALIZED,
                    QuotationStatus.SENT,
                ]),
                Quotation.created_at < cutoff,
            )
            .update(
                {"status": QuotationStatus.EXPIRED},
                synchronize_session="fetch",
            )
        )
        db.commit()

        logger.info(
            "Expired quotations cleaned up",
            extra={"count": result},
        )
        return {"status": "completed", "expired_count": result}

    except Exception as exc:
        logger.error(
            "Cleanup of expired quotations failed",
            extra={"error": str(exc)},
        )
        if db:
            db.rollback()
        raise self.retry(exc=exc)

    finally:
        if db:
            db.close()
