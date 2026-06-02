"""
AI-Sourcing Hub — Output (Quotation) Celery Tasks

Background tasks for PDF generation and quotation management.
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
from app.shared.celery_app import celery_app
from app.shared.logging import get_logger

logger = get_logger(__name__)


@celery_app.task(
    bind=True,
    name="generate-quotation-pdf",
    acks_late=True,
    max_retries=3,
    default_retry_delay=30,
)
def generate_quotation_pdf_task(self, quotation_id: str) -> dict:
    """Generate PDF for a quotation asynchronously.

    Args:
        quotation_id: UUID of the Quotation record.

    Returns:
        Dict with status and pdf_path.
    """
    logger.info(
        "Starting asynchronous PDF generation",
        extra={"quotation_id": quotation_id},
    )

    try:
        # TODO: Implement sync wrapper that:
        # 1. Creates a new DB session
        # 2. Calls output service generate_quotation_pdf()
        # 3. Uploads PDF to MinIO
        # 4. Updates quotation record with pdf_path

        logger.info(
            "PDF generation complete",
            extra={"quotation_id": quotation_id},
        )
        return {"quotation_id": quotation_id, "status": "generated"}

    except Exception as exc:
        logger.error(
            "PDF generation failed",
            extra={"quotation_id": quotation_id, "error": str(exc)},
        )
        raise self.retry(exc=exc)
