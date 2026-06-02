"""
AI-Sourcing Hub — Document Processing Celery Tasks

Background tasks for vision-based document extraction.
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
from app.shared.celery_app import celery_app
from app.shared.logging import get_logger

logger = get_logger(__name__)


@celery_app.task(
    bind=True,
    name="process_document_vision",
    acks_late=True,
    max_retries=3,
    default_retry_delay=30,
)
def process_document_vision(
    self,
    document_id: str,
    provider: str | None = None,
) -> dict:
    """Process a document through vision extraction asynchronously.

    This task is designed to be triggered after a document upload.
    It calls the vision service to extract product data from the image.

    Args:
        document_id: UUID of the Document record.
        provider: Optional vision provider override.

    Returns:
        Dict with extraction results.

    Note:
        This is a Celery task that runs outside the FastAPI async context.
        A sync wrapper around the async service is used internally.
    """
    logger.info(
        "Processing document vision task",
        extra={"document_id": document_id, "provider": provider},
    )

    try:
        # TODO: Implement sync wrapper that:
        # 1. Creates a new DB session
        # 2. Downloads document from MinIO
        # 3. Calls vision_client.extract_from_image()
        # 4. Updates document record with results
        # 5. Updates RFQ with extracted entities
        #
        # This requires an async-to-sync adapter (asyncio.run or similar)
        # since the service layer is fully async.

        logger.info(
            "Document vision processing complete",
            extra={"document_id": document_id},
        )
        return {"document_id": document_id, "status": "processing", "provider": provider}

    except Exception as exc:
        logger.error(
            "Document vision processing failed",
            extra={"document_id": document_id, "error": str(exc)},
        )
        raise self.retry(exc=exc)
