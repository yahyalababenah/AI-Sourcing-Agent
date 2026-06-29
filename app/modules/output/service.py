from __future__ import annotations

"""
AI-Sourcing Hub — Quotation Service Layer

Handles quotation creation, PDF generation via WeasyPrint,
and quotation lifecycle management.
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.config import settings
from app.modules.intake.models import RFQ, RFQStatus
from app.modules.output.models import Quotation, QuotationStatus
from app.modules.output.schemas import (
    QuotationCreate,
    QuotationGeneratePdfResponse,
    QuotationListResponse,
    QuotationResponse,
)
from app.modules.pricing.models import QuotationLineItem
from app.shared.exceptions import NotFoundException, QuoteGenerationError
from app.shared.logging import get_logger
from app.shared.storage import storage_client

logger = get_logger(__name__)


# ═══════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════

def _generate_quotation_number() -> str:
    """Generate a unique quotation number.

    Format: Q-YYYYMMDD-XXXX (e.g., Q-20260602-0001)
    """
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    unique_id = str(uuid.uuid4()).split("-")[0].upper()[:4]
    return f"Q-{today}-{unique_id}"


# ═══════════════════════════════════════════════════════════
# CRUD
# ═══════════════════════════════════════════════════════════

async def create_quotation(
    db: AsyncSession,
    agent_id: str,
    data: QuotationCreate,
) -> Quotation:
    """Create a new quotation from calculated pricing data.

    Args:
        db: Database session.
        agent_id: Creating agent UUID string.
        data: Quotation creation data.

    Returns:
        Created Quotation instance.

    Raises:
        NotFoundException: If referenced RFQ not found.
    """
    # Verify RFQ exists
    result = await db.execute(
        select(RFQ).where(RFQ.id == uuid.UUID(data.rfq_id))
    )
    rfq = result.scalar_one_or_none()
    if not rfq:
        raise NotFoundException(
            resource="RFQ",
            resource_id=data.rfq_id,
        )

    # Create quotation
    quotation = Quotation(
        rfq_id=uuid.UUID(data.rfq_id),
        agent_id=uuid.UUID(agent_id),
        quotation_number=_generate_quotation_number(),
        status=QuotationStatus.DRAFT,
        target_currency=data.target_currency,
        exchange_rate_used=data.exchange_rate_used,
        subtotal=data.subtotal,
        freight_total=data.freight_total or 0.0,
        customs_total=data.customs_total or 0.0,
        commission_total=data.commission_total or 0.0,
        discount_total=data.discount_total or 0.0,
        vat_total=data.vat_total or 0.0,
        grand_total=data.grand_total,
        payment_terms=data.payment_terms,
        delivery_terms=data.delivery_terms,
        validity_days=data.validity_days,
        notes=data.notes,
    )
    db.add(quotation)
    await db.flush()

    # Create line items
    for item in data.line_items:
        product_uuid = uuid.UUID(item.product_id) if item.product_id else None
        exchange_rate = item.exchange_rate if item.exchange_rate is not None else data.exchange_rate_used
        computed_subtotal = item.subtotal if item.subtotal is not None else (
            item.unit_price_converted * item.quantity
            + item.freight_cost + item.customs_duty + item.commission
        )
        line_item = QuotationLineItem(
            quotation_id=quotation.id,
            product_id=product_uuid,
            product_name=item.product_name,
            quantity=item.quantity,
            unit_price_cny=item.unit_price_cny,
            unit_price_converted=item.unit_price_converted,
            exchange_rate_used=exchange_rate,
            freight_cost=item.freight_cost,
            customs_duty=item.customs_duty,
            commission=item.commission,
            subtotal=computed_subtotal,
            discount=item.discount,
            total=item.total,
        )
        db.add(line_item)

    await db.flush()

    # Re-fetch with eager-loaded line_items — refresh() would expire column
    # attributes and trigger MissingGreenlet during Pydantic serialisation.
    result = await db.execute(
        select(Quotation)
        .options(joinedload(Quotation.line_items))
        .where(Quotation.id == quotation.id)
    )
    return result.unique().scalar_one()


async def get_quotation(db: AsyncSession, quotation_id: str) -> Quotation:
    """Get a quotation by ID.

    Args:
        db: Database session.
        quotation_id: Quotation UUID string.

    Returns:
        Quotation instance.

    Raises:
        NotFoundException: If not found.
    """
    from sqlalchemy.orm import joinedload

    result = await db.execute(
        select(Quotation)
        .options(joinedload(Quotation.line_items), joinedload(Quotation.rfq))
        .where(Quotation.id == uuid.UUID(quotation_id))
    )
    quotation = result.unique().scalar_one_or_none()
    if not quotation:
        raise NotFoundException(
            resource="Quotation",
            resource_id=quotation_id,
        )
    return quotation


async def list_quotations(
    db: AsyncSession,
    agent_id: Optional[str] = None,
    client_id: Optional[str] = None,
    rfq_id: Optional[str] = None,
    status: Optional[QuotationStatus] = None,
) -> QuotationListResponse:
    """List quotations with optional filtering and role-based scoping.

    Args:
        db: Database session.
        agent_id: Optional agent filter.
        client_id: Optional client filter (scopes to RFQs owned by client).
        rfq_id: Optional RFQ filter.
        status: Optional status filter.

    Returns:
        QuotationListResponse.
    """
    from app.modules.intake.models import RFQ

    query = select(Quotation).options(joinedload(Quotation.line_items))

    if client_id:
        # Client scope: quotations for RFQs where client_id == current user
        query = query.join(RFQ, Quotation.rfq_id == RFQ.id).where(
            RFQ.client_id == uuid.UUID(client_id)
        )
    elif agent_id:
        query = query.where(Quotation.agent_id == uuid.UUID(agent_id))
    # Admin: no filter — full table access

    if rfq_id:
        query = query.where(Quotation.rfq_id == uuid.UUID(rfq_id))
    if status:
        query = query.where(Quotation.status == status)

    query = query.order_by(Quotation.created_at.desc())
    result = await db.execute(query)
    quotations = list(result.unique().scalars().all())

    return QuotationListResponse(
        items=[QuotationResponse.model_validate(q) for q in quotations],
        total=len(quotations),
    )


async def update_quotation_status(
    db: AsyncSession,
    quotation_id: str,
    new_status: QuotationStatus,
) -> Quotation:
    """Update quotation status.

    Args:
        db: Database session.
        quotation_id: Quotation UUID string.
        new_status: Target status.

    Returns:
        Updated Quotation instance.
    """
    quotation = await get_quotation(db, quotation_id)
    quotation.status = new_status
    await db.flush()

    # Re-fetch with eager-loaded line_items; refresh() alone drops the
    # relationship from the identity map, which would trigger MissingGreenlet
    # during Pydantic serialisation.
    result = await db.execute(
        select(Quotation)
        .options(joinedload(Quotation.line_items))
        .where(Quotation.id == quotation.id)
    )
    quotation = result.unique().scalar_one()
    return quotation


# ═══════════════════════════════════════════════════════════
# PDF Generation
# ═══════════════════════════════════════════════════════════

async def generate_quotation_pdf(
    db: AsyncSession,
    quotation_id: str,
    show_details: bool = False,
) -> QuotationGeneratePdfResponse:
    """Generate PDF for a quotation using Jinja2 + WeasyPrint.

    Args:
        db: Database session.
        quotation_id: Quotation UUID string.
        show_details: Whether to show detailed cost breakdown in PDF.

    Returns:
        QuotationGeneratePdfResponse with PDF path and URL.

    Raises:
        QuoteGenerationError: If PDF generation fails.
    """
    quotation = await get_quotation(db, quotation_id)

    # Get related data
    rfq_result = await db.execute(
        select(RFQ).where(RFQ.id == quotation.rfq_id)
    )
    rfq = rfq_result.scalar_one_or_none()

    # Get line items
    items_result = await db.execute(
        select(QuotationLineItem)
        .where(QuotationLineItem.quotation_id == quotation.id)
        .order_by(QuotationLineItem.created_at.asc())
    )
    line_items = list(items_result.scalars().all())

    try:
        from jinja2 import Environment, FileSystemLoader

        # Set up Jinja2
        template_dir = os.path.join(
            os.path.dirname(__file__), "templates"
        )
        env = Environment(loader=FileSystemLoader(template_dir))
        template = env.get_template("quotation.html")

        # Prepare template data
        valid_until = datetime.now(timezone.utc) + timedelta(
            days=quotation.validity_days or 30
        )

        # Look for bundled Noto Sans Arabic font files
        font_path = os.path.join(template_dir, "..", "..", "..", "static", "fonts", "NotoSansArabic-Regular.ttf")
        font_bold_path = os.path.join(template_dir, "..", "..", "..", "static", "fonts", "NotoSansArabic-Bold.ttf")
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
            show_details=show_details,
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
            # Bank details
            bank_name="",
            bank_beneficiary="",
            bank_iban="",
            bank_swift="",
            year=datetime.now(timezone.utc).year,
        )

        # Generate PDF with WeasyPrint
        try:
            from weasyprint import HTML

            pdf_bytes = HTML(string=html).write_pdf()
        except Exception as exc:
            logger.error("WeasyPrint PDF generation failed", extra={"error": str(exc)})
            raise QuoteGenerationError(
                message="Failed to generate PDF. WeasyPrint may not be available.",
                details={"quotation_id": quotation_id, "error": str(exc)},
            )

        # Upload PDF to MinIO
        pdf_key = f"{quotation.rfq_id}/{quotation.id}/quotation_{quotation.quotation_number}.pdf"

        try:
            await storage_client.upload_file(
                file_bytes=pdf_bytes,
                key=pdf_key,
                content_type="application/pdf",
                bucket=settings.STORAGE_BUCKET_QUOTES,
            )
        except Exception as exc:
            logger.error("Failed to upload PDF to MinIO", extra={"error": str(exc)})
            raise QuoteGenerationError(
                message="Failed to upload generated PDF to storage",
                details={"quotation_id": quotation_id, "error": str(exc)},
            )

        # Update quotation record
        quotation.pdf_path = pdf_key
        quotation.pdf_generated_at = datetime.now(timezone.utc)
        await db.flush()
        await db.refresh(quotation)

        # Generate presigned URL
        pdf_url = await storage_client.get_presigned_url(
            key=pdf_key,
            bucket=settings.STORAGE_BUCKET_QUOTES,
            expiry=3600,
        )

        return QuotationGeneratePdfResponse(
            quotation_id=str(quotation.id),
            pdf_path=pdf_key,
            pdf_url=pdf_url,
        )

    except (ImportError, QuoteGenerationError):
        raise
    except Exception as exc:
        logger.error("Unexpected PDF generation error", extra={"error": str(exc)})
        raise QuoteGenerationError(
            message="Unexpected error during PDF generation",
            details={"quotation_id": quotation_id, "error": str(exc)},
        )


async def finalize_quotation(
    db: AsyncSession,
    quotation_id: str,
) -> Quotation:
    """Finalize a quotation (generate PDF and update status).

    Args:
        db: Database session.
        quotation_id: Quotation UUID string.

    Returns:
        Updated Quotation instance.
    """
    # Generate PDF first
    await generate_quotation_pdf(db, quotation_id, show_details=False)

    # Update status to finalized
    quotation = await update_quotation_status(
        db, quotation_id, QuotationStatus.FINALIZED
    )

    # Update RFQ status to quoted
    rfq_result = await db.execute(
        select(RFQ).where(RFQ.id == quotation.rfq_id)
    )
    rfq = rfq_result.scalar_one_or_none()
    if rfq and rfq.status == RFQStatus.PROCESSING:
        rfq.status = RFQStatus.QUOTED
        await db.flush()

    return quotation


# ═══════════════════════════════════════════════════════════
# Order Tracking
# ═══════════════════════════════════════════════════════════

TRACKING_PIPELINE: list[str] = [
    "awaiting_payment",
    "production",
    "inland_freight",
    "sea_freight",
    "customs",
    "delivered",
]


def _validate_tracking_transition(
    current: Optional[str], next_status: str
) -> None:
    """Validate that ``next_status`` follows the pipeline order.

    Args:
        current: Current tracking status (None if not yet set).
        next_status: Desired new status.

    Raises:
        ValueError: If the transition is invalid.
    """
    if current is None:
        # First status must be awaiting_payment
        if next_status != TRACKING_PIPELINE[0]:
            raise ValueError(
                f"First tracking status must be '{TRACKING_PIPELINE[0]}', "
                f"got '{next_status}'"
            )
        return

    if current not in TRACKING_PIPELINE:
        raise ValueError(f"Unknown current tracking status '{current}'")
    if next_status not in TRACKING_PIPELINE:
        raise ValueError(f"Unknown next tracking status '{next_status}'")

    current_idx = TRACKING_PIPELINE.index(current)
    next_idx = TRACKING_PIPELINE.index(next_status)

    # Allow forward movement only (or same status — idempotent)
    if next_idx < current_idx:
        raise ValueError(
            f"Cannot move backward in tracking pipeline: "
            f"'{current}' → '{next_status}'"
        )


async def get_tracking(
    db: AsyncSession, quotation_id: str
) -> TrackingStatusResponse:
    """Get the current tracking status and full event history for an order.

    Args:
        db: Database session.
        quotation_id: Quotation UUID string.

    Returns:
        TrackingStatusResponse with current status and event timeline.

    Raises:
        NotFoundException: If quotation not found.
    """
    from app.modules.output.models import TrackingEvent

    result = await db.execute(
        select(Quotation)
        .options(
            joinedload(Quotation.tracking_events).joinedload(
                TrackingEvent.changed_by
            ),
        )
        .where(Quotation.id == uuid.UUID(quotation_id))
    )
    quotation = result.unique().scalar_one_or_none()
    if not quotation:
        raise NotFoundException(
            resource="Quotation",
            resource_id=quotation_id,
        )

    events = [
        TrackingEventResponse(
            id=ev.id,
            quotation_id=ev.quotation_id,
            from_status=ev.from_status.value if ev.from_status else None,
            to_status=ev.to_status.value,
            notes=ev.notes,
            changed_by_id=ev.changed_by_id,
            created_at=ev.created_at,
        )
        for ev in (quotation.tracking_events or [])
    ]

    return TrackingStatusResponse(
        quotation_id=quotation.id,
        quotation_number=quotation.quotation_number,
        current_status=quotation.tracking_status.value
        if quotation.tracking_status
        else None,
        events=events,
    )


async def update_tracking(
    db: AsyncSession,
    quotation_id: str,
    new_status: str,
    notes: Optional[str] = None,
    changed_by_id: Optional[str] = None,
) -> TrackingStatusResponse:
    """Update the tracking status for an order (accepted quotation).

    Validates the pipeline transition, updates the Quotation's
    ``tracking_status``, and creates a ``TrackingEvent`` audit log entry.

    Args:
        db: Database session.
        quotation_id: Quotation UUID string.
        new_status: Target tracking status string.
        notes: Optional note from the agent.
        changed_by_id: Optional user UUID who made the change.

    Returns:
        Updated TrackingStatusResponse.

    Raises:
        NotFoundException: If quotation not found.
        ValueError: If the transition is invalid.
    """
    from app.modules.output.models import TrackingEvent, TrackingStatus

    result = await db.execute(
        select(Quotation)
        .options(joinedload(Quotation.tracking_events))
        .where(Quotation.id == uuid.UUID(quotation_id))
    )
    quotation = result.unique().scalar_one_or_none()
    if not quotation:
        raise NotFoundException(
            resource="Quotation",
            resource_id=quotation_id,
        )

    # Parse new status
    try:
        target_enum = TrackingStatus(new_status)
    except ValueError:
        raise ValueError(
            f"Invalid tracking status '{new_status}'. "
            f"Must be one of: {', '.join(TRACKING_PIPELINE)}"
        )

    current = quotation.tracking_status

    # Validate transition
    _validate_tracking_transition(
        current.value if current else None,
        target_enum.value,
    )

    from_status_value = current.value if current else None

    # Update quotation
    quotation.tracking_status = target_enum

    # Create event log
    event = TrackingEvent(
        quotation_id=quotation.id,
        from_status=current,
        to_status=target_enum,
        notes=notes,
        changed_by_id=uuid.UUID(changed_by_id) if changed_by_id else None,
    )
    db.add(event)
    await db.flush()

    logger.info(
        "Tracking updated for quotation %s: %s → %s",
        quotation_id,
        from_status_value,
        target_enum.value,
    )

    # Re-fetch with events
    await db.refresh(quotation)
    return await get_tracking(db, quotation_id)


# Required for type annotations used in this module
from app.modules.output.schemas import (  # noqa: E402
    TrackingEventResponse,
    TrackingStatusResponse,
)
