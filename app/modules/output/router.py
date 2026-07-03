"""
AI-Sourcing Hub — Quotation Endpoints

/api/v1/quotes                  POST   Create quotation
/api/v1/quotes                  GET    List quotations
/api/v1/quotes/generate         POST   Create quotation + enqueue Celery PDF gen (async)
/api/v1/quotes/{id}             GET    Get quotation details
/api/v1/quotes/{id}/status      PUT    Update quotation status
/api/v1/quotes/{id}/pdf         POST   Generate PDF for quotation (synchronous)
/api/v1/quotes/{id}/pdf         GET    Redirect to presigned PDF URL
/api/v1/quotes/{id}/finalize    POST   Finalize quotation (PDF + status)
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status as fastapi_status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.dependencies import get_current_user, require_agent_or_admin
from app.modules.auth.models import User, UserRole
from app.shared.exceptions import AuthorizationError
from app.modules.output.models import QuotationStatus
from app.modules.output.schemas import (
    QuotationCreate,
    QuotationGenerateAcceptedResponse,
    QuotationGeneratePdfResponse,
    QuotationGenerateRequest,
    QuotationListResponse,
    QuotationResponse,
    TrackingStatusResponse,
    UpdateTrackingRequest,
)
from app.modules.output.service import (
    create_quotation,
    finalize_quotation,
    generate_quotation_pdf,
    get_quotation,
    get_tracking,
    list_quotations,
    update_quotation_status,
    update_tracking,
)
from app.shared.database import get_db
from app.shared.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.post(
    "",
    response_model=QuotationResponse,
    status_code=201,
    summary="Create a new quotation",
)
async def create(
    data: QuotationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_agent_or_admin),
):
    """Create a new quotation from calculated pricing data."""
    quotation = await create_quotation(db, agent_id=str(current_user.id), data=data)
    return QuotationResponse.model_validate(quotation)


@router.get(
    "",
    response_model=QuotationListResponse,
    summary="List quotations",
)
async def list_quotes(
    rfq_id: Optional[str] = Query(None, description="Filter by RFQ"),
    status: Optional[QuotationStatus] = Query(None, description="Filter by status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List quotations with role-based data isolation scoping.

    - Admin: Sees all quotations.
    - Agent: Sees quotations they created.
    - Client: Sees quotations for RFQs they own (via client_id join).
    """
    user_id = str(current_user.id)
    if current_user.role == UserRole.CLIENT:
        return await list_quotations(
            db, client_id=user_id, rfq_id=rfq_id, status=status
        )
    elif current_user.role == UserRole.AGENT:
        return await list_quotations(
            db, agent_id=user_id, rfq_id=rfq_id, status=status
        )
    # Admin: full access
    return await list_quotations(
        db, rfq_id=rfq_id, status=status
    )


@router.post(
    "/generate",
    response_model=QuotationGenerateAcceptedResponse,
    status_code=fastapi_status.HTTP_201_CREATED,
    summary="Generate quotation (PDF generated synchronously)",
)
async def generate_async(
    data: QuotationGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_agent_or_admin),
):
    """Create a quotation and generate its PDF.

    TEMPORARY: sync fallback for demo, revert to Celery async once worker
    hosting is resolved. PDF generation (Jinja2 + WeasyPrint + MinIO upload)
    now runs inline via ``generate_quotation_pdf`` instead of being enqueued
    on Celery, because Celery workers are not reliably available in the
    current hosting environment. If PDF generation fails, the quotation is
    still returned (status="pdf_failed") so the demo doesn't hard-block —
    the frontend can retry via ``POST /quotes/{id}/pdf``.
    """
    # Create quotation
    create_data = QuotationCreate(
        rfq_id=data.rfq_id,
        target_currency=data.target_currency,
        exchange_rate_used=data.exchange_rate_used,
        line_items=data.line_items,
        subtotal=data.subtotal,
        freight_total=data.freight_total,
        customs_total=data.customs_total,
        commission_total=data.commission_total,
        discount_total=data.discount_total,
        vat_total=data.vat_total,
        grand_total=data.grand_total,
        payment_terms=data.payment_terms,
        delivery_terms=data.delivery_terms,
        validity_days=data.validity_days,
        notes=data.notes,
    )
    quotation = await create_quotation(db, agent_id=str(current_user.id), data=create_data)

    # Generate the PDF synchronously (TEMPORARY: sync fallback for demo,
    # revert to Celery async once worker hosting is resolved).
    status_value = "completed"
    message = "Quotation created. PDF generated."
    pdf_url: Optional[str] = None
    try:
        pdf_result = await generate_quotation_pdf(db, str(quotation.id))
        pdf_url = pdf_result.pdf_url
    except Exception as exc:
        logger.error(
            "Synchronous PDF generation failed for quotation %s: %s",
            quotation.id,
            exc,
        )
        status_value = "pdf_failed"
        message = "Quotation created, but PDF generation failed. Retry via POST /quotes/{id}/pdf."

    # Notify the client that their quote is ready
    from sqlalchemy import select as _select
    from app.modules.intake.models import RFQ
    rfq_result = await db.execute(_select(RFQ).where(RFQ.id == quotation.rfq_id))
    rfq_obj = rfq_result.scalar_one_or_none()
    if rfq_obj and rfq_obj.client_id:
        from app.shared.notifications import notify_user
        await notify_user(str(rfq_obj.client_id), {
            "type": "quote_ready",
            "title": "عرض سعر جديد",
            "body": f"وصلك عرض سعر جديد — {quotation.quotation_number}",
            "quotation_id": str(quotation.id),
            "rfq_id": str(quotation.rfq_id),
        })

    return QuotationGenerateAcceptedResponse(
        quotation_id=str(quotation.id),
        status=status_value,
        message=message,
        pdf_url=pdf_url,
    )


@router.get(
    "/{quotation_id}",
    response_model=QuotationResponse,
    summary="Get quotation details",
)
async def get(
    quotation_id: str,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Get detailed information about a quotation."""
    quotation = await get_quotation(db, quotation_id)
    return QuotationResponse.model_validate(quotation)


@router.put(
    "/{quotation_id}/status",
    response_model=QuotationResponse,
    summary="Update quotation status",
)
async def update_status(
    quotation_id: str,
    new_status: QuotationStatus,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_agent_or_admin),
):
    """Update the status of a quotation.

    Agents can only update quotations they created.
    Admins can update any quotation.
    """
    quotation = await get_quotation(db, quotation_id)
    if current_user.role != UserRole.ADMIN and str(quotation.agent_id) != str(current_user.id):
        raise AuthorizationError(message="You can only update quotations you created")
    quotation = await update_quotation_status(db, quotation_id, new_status)
    return QuotationResponse.model_validate(quotation)


@router.post(
    "/{quotation_id}/pdf",
    response_model=QuotationGeneratePdfResponse,
    summary="Generate PDF for quotation (synchronous)",
)
async def generate_pdf(
    quotation_id: str,
    show_details: bool = Query(False, description="Include detailed cost breakdown"),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_agent_or_admin),
):
    """Generate a PDF document for a quotation using Jinja2 + WeasyPrint (synchronous)."""
    return await generate_quotation_pdf(db, quotation_id, show_details=show_details)


@router.get(
    "/{quotation_id}/pdf",
    response_class=RedirectResponse,
    summary="Redirect to presigned PDF URL",
)
async def get_pdf_redirect(
    quotation_id: str,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Redirect to the presigned MinIO URL for the quotation PDF.

    Returns a 302 redirect to a temporary (15-minute) presigned URL.
    Returns 404 if no PDF has been generated yet.
    Returns 403 if the quotation has been rejected or expired.
    """
    from app.modules.output.service import get_quotation

    quotation = await get_quotation(db, quotation_id)

    # Revoke access for terminal negative states — PDF should not be accessible
    if quotation.status in (QuotationStatus.REJECTED, QuotationStatus.EXPIRED):
        raise HTTPException(
            status_code=403,
            detail=f"PDF access denied — quotation is {quotation.status.value}",
        )

    if not quotation.pdf_path:
        raise HTTPException(
            status_code=404,
            detail="PDF not yet generated for this quotation",
        )

    from app.shared.storage import storage_client
    from app.config import settings

    # 15 minutes — short enough to limit exposure if URL is leaked or shared
    pdf_url = await storage_client.get_presigned_url(
        key=quotation.pdf_path,
        bucket=settings.STORAGE_BUCKET_QUOTES,
        expiry=900,
    )

    return RedirectResponse(url=pdf_url)


@router.post(
    "/{quotation_id}/accept",
    response_model=QuotationResponse,
    summary="Client accepts a quotation",
)
async def client_accept(
    quotation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Client accepts a quotation that was sent to them.

    - Verifies the current user is the client who owns the RFQ.
    - Sets status to ACCEPTED and triggers the first tracking step.
    """
    from sqlalchemy import select as _select
    from app.modules.intake.models import RFQ
    from app.modules.output.models import Quotation

    quotation = await get_quotation(db, quotation_id)

    # Allow clients only — agent/admin use the generic status endpoint
    if current_user.role == UserRole.AGENT:
        raise AuthorizationError(message="Agents cannot accept their own quotes")

    if current_user.role == UserRole.CLIENT:
        rfq_result = await db.execute(_select(RFQ).where(RFQ.id == quotation.rfq_id))
        rfq = rfq_result.scalar_one_or_none()
        if not rfq or str(rfq.client_id) != str(current_user.id):
            raise AuthorizationError(message="You can only accept quotes for your own RFQs")

    if quotation.status not in (QuotationStatus.FINALIZED, QuotationStatus.SENT):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot accept a quote with status '{quotation.status.value}'",
        )

    quotation = await update_quotation_status(db, quotation_id, QuotationStatus.ACCEPTED)

    # Auto-create the first tracking step
    try:
        await update_tracking(
            db,
            quotation_id,
            new_status="awaiting_payment",
            notes="العميل وافق على عرض السعر",
            changed_by_id=str(current_user.id),
        )
    except ValueError:
        pass  # Tracking may already exist

    # Notify the agent
    from app.shared.notifications import notify_user
    await notify_user(str(quotation.agent_id), {
        "type": "quote_accepted",
        "title": "تم قبول عرض السعر",
        "body": f"العميل وافق على العرض {quotation.quotation_number}",
        "quotation_id": str(quotation.id),
    })

    return QuotationResponse.model_validate(quotation)


@router.post(
    "/{quotation_id}/reject",
    response_model=QuotationResponse,
    summary="Client rejects a quotation",
)
async def client_reject(
    quotation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Client rejects a quotation."""
    from sqlalchemy import select as _select
    from app.modules.intake.models import RFQ

    quotation = await get_quotation(db, quotation_id)

    if current_user.role == UserRole.CLIENT:
        rfq_result = await db.execute(_select(RFQ).where(RFQ.id == quotation.rfq_id))
        rfq = rfq_result.scalar_one_or_none()
        if not rfq or str(rfq.client_id) != str(current_user.id):
            raise AuthorizationError(message="You can only reject quotes for your own RFQs")

    quotation = await update_quotation_status(db, quotation_id, QuotationStatus.REJECTED)
    return QuotationResponse.model_validate(quotation)


@router.post(
    "/{quotation_id}/finalize",
    response_model=QuotationResponse,
    summary="Finalize quotation (generate PDF + update status)",
)
async def finalize(
    quotation_id: str,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_agent_or_admin),
):
    """Finalize a quotation: generate PDF and set status to finalized.

    Also updates the parent RFQ status to 'quoted'.
    """
    quotation = await finalize_quotation(db, quotation_id)
    return QuotationResponse.model_validate(quotation)


# ═══════════════════════════════════════════════════════════
# Order Tracking Endpoints
# ═══════════════════════════════════════════════════════════


@router.get(
    "/{quotation_id}/tracking",
    response_model=TrackingStatusResponse,
    summary="Get order tracking status and history",
)
async def get_tracking_endpoint(
    quotation_id: str,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Get the current tracking status and full event history for an order.

    Accessible by all authenticated users who have access to the quotation.
    """
    return await get_tracking(db, quotation_id)


@router.put(
    "/{quotation_id}/tracking",
    response_model=TrackingStatusResponse,
    summary="Update order tracking status",
)
async def update_tracking_endpoint(
    quotation_id: str,
    body: UpdateTrackingRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_agent_or_admin),
):
    """Update the tracking status for an order.

    Validates pipeline order and creates an audit log entry.
    Only agents and admins can update tracking status.
    """
    try:
        return await update_tracking(
            db,
            quotation_id,
            new_status=body.status,
            notes=body.notes,
            changed_by_id=str(current_user.id),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=fastapi_status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
