"""
AI-Sourcing Hub — Quotation Endpoints

/api/v1/quotes                  POST   Create quotation
/api/v1/quotes                  GET    List quotations
/api/v1/quotes/{id}             GET    Get quotation details
/api/v1/quotes/{id}/status      PUT    Update quotation status
/api/v1/quotes/{id}/pdf         POST   Generate PDF for quotation
/api/v1/quotes/{id}/finalize    POST   Finalize quotation (PDF + status)
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.dependencies import get_current_user, require_agent_or_admin
from app.modules.auth.models import User
from app.modules.output.models import QuotationStatus
from app.modules.output.schemas import (
    QuotationCreate,
    QuotationGeneratePdfResponse,
    QuotationListResponse,
    QuotationResponse,
)
from app.modules.output.service import (
    create_quotation,
    finalize_quotation,
    generate_quotation_pdf,
    get_quotation,
    list_quotations,
    update_quotation_status,
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
    current_user: User = Depends(require_agent_or_admin),
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
    """List quotations with optional filtering by RFQ or status."""
    agent_id = str(current_user.id) if current_user.role != "admin" else None
    return await list_quotations(
        db, agent_id=agent_id, rfq_id=rfq_id, status=status
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
    summary="Generate PDF for quotation",
)
async def generate_pdf(
    quotation_id: str,
    show_details: bool = Query(False, description="Include detailed cost breakdown"),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_agent_or_admin),
):
    """Generate a PDF document for a quotation using Jinja2 + WeasyPrint."""
    return await generate_quotation_pdf(db, quotation_id, show_details=show_details)


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
