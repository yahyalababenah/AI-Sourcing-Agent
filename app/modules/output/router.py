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
    status_code=fastapi_status.HTTP_202_ACCEPTED,
    summary="Generate quotation asynchronously (Celery)",
)
async def generate_async(
    data: QuotationGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_agent_or_admin),
):
    """Create a quotation and enqueue background PDF generation.

    Accepts pricing data, creates a Quotation record, then dispatches
    a Celery task to generate the PDF asynchronously.

    Returns 202 Accepted immediately with the quotation_id.
    The client can poll ``GET /api/v1/quotes/{id}`` to check
    ``pdf_generated_at`` for completion.
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

    # Enqueue Celery task
    from app.modules.output.tasks import generate_quotation_pdf_task

    generate_quotation_pdf_task.delay(str(quotation.id))

    return QuotationGenerateAcceptedResponse(
        quotation_id=str(quotation.id),
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
    _current_user: User = Depends(require_agent_or_admin),
):
    """Update the status of a quotation."""
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

    Returns a 302 redirect to a temporary (1-hour) presigned URL.
    Returns 404 if no PDF has been generated yet.
    """
    from app.modules.output.service import get_quotation

    quotation = await get_quotation(db, quotation_id)

    if not quotation.pdf_path:
        raise HTTPException(
            status_code=404,
            detail="PDF not yet generated for this quotation",
        )

    from app.shared.storage import storage_client
    from app.config import settings

    pdf_url = await storage_client.get_presigned_url(
        key=quotation.pdf_path,
        bucket=settings.STORAGE_BUCKET_QUOTES,
        expiry=3600,
    )

    return RedirectResponse(url=pdf_url)


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
