"""
AI-Sourcing Hub — Intake Service Layer

Business logic for RFQ intake, translation, and entity extraction.
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import uuid
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.intake.llm_client import extract_entities, translate_and_extract
from app.modules.intake.models import RFQ, Product, RFQStatus, ProductStatus
from app.modules.intake.schemas import RFQCreate, RFQResponse, RFQListResponse
from app.shared.exceptions import (
    IncompleteExtractionError,
    NotFoundException,
    ValidationError,
)
from app.shared.logging import get_logger
from app.shared.pagination import PaginationParams

logger = get_logger(__name__)


# ═══════════════════════════════════════════════════════════
# Translation
# ═══════════════════════════════════════════════════════════

async def translate_request(
    arabic_text: str,
    provider: Optional[str] = None,
) -> dict:
    """Translate an Arabic client request and extract entities.

    Two-stage pipeline:
        1. Extract product entities from Arabic (Prompt A)
        2. Translate to Chinese (Prompt B)

    Validates that extracted entities contain at least one product with
    valid name and positive quantity.

    Args:
        arabic_text: Raw Arabic text from the client.
        provider: Optional LLM provider override.

    Returns:
        Dict with request_id, chinese_query, entities, confidence.

    Raises:
        IncompleteExtractionError: If extraction yields no valid products.
        ProviderUnavailableError: If all LLM providers fail.
    """
    result = await translate_and_extract(arabic_text, provider=provider)

    # Defense-in-depth: validate entities at service layer
    entities = result.get("entities", {})
    products = entities.get("products", [])
    if not products:
        raise IncompleteExtractionError(
            message="No products extracted from Arabic text",
            details={"arabic_text_preview": arabic_text[:200]},
        )

    for i, product in enumerate(products):
        name = (product.get("name_arabic") or "").strip()
        if not name:
            raise IncompleteExtractionError(
                message=f"Product at index {i} is missing a name",
                details={"product_index": i, "product": product},
            )
        quantity = product.get("quantity", 0)
        if not isinstance(quantity, (int, float)) or quantity <= 0:
            raise IncompleteExtractionError(
                message=f"Product '{name}' has invalid quantity: {quantity}",
                details={"product_index": i, "product": product, "quantity": quantity},
            )

    return result


# ═══════════════════════════════════════════════════════════
# CRUD
# ═══════════════════════════════════════════════════════════

async def create_rfq(
    db: AsyncSession,
    rfq_data: RFQCreate,
    agent_id: Optional[str] = None,
    client_id: Optional[str] = None,
) -> RFQ:
    """Create a new RFQ with role-aware ownership assignment.

    Args:
        db: Database session.
        rfq_data: RFQ creation data.
        agent_id: UUID of the creating agent (None if client-created).
        client_id: UUID of the client (None if agent-created without specific client).

    Returns:
        Created RFQ instance.
    """
    rfq = RFQ(
        agent_id=uuid.UUID(agent_id) if agent_id else None,
        client_id=uuid.UUID(client_id) if client_id else None,
        client_name=rfq_data.client_name,
        client_phone=rfq_data.client_phone,
        client_request_arabic=rfq_data.client_request_arabic,
        translated_query_chinese=getattr(rfq_data, 'translated_query_chinese', None),
        extracted_entities=getattr(rfq_data, 'extracted_entities', None),
        destination_port=rfq_data.destination_port,
        target_currency=rfq_data.target_currency,
        status=RFQStatus.OPEN,
    )
    db.add(rfq)
    await db.flush()
    await db.refresh(rfq)
    return rfq


async def get_rfq(
    db: AsyncSession,
    rfq_id: str,
    current_user_id: Optional[str] = None,
    current_user_role: Optional[str] = None,
) -> RFQ:
    """Get an RFQ by ID with optional ownership scope check.

    Args:
        db: Database session.
        rfq_id: RFQ UUID string.
        current_user_id: UUID of the requesting user (for scope check).
        current_user_role: Role of the requesting user (for scope check).

    Returns:
        RFQ instance.

    Raises:
        NotFoundException: If RFQ not found or not accessible by user.
    """
    result = await db.execute(
        select(RFQ).where(RFQ.id == uuid.UUID(rfq_id))
    )
    rfq = result.scalar_one_or_none()
    if not rfq:
        raise NotFoundException(
            resource="RFQ",
            resource_id=rfq_id,
        )
    # Enforce data isolation for non-admin users
    if current_user_id and current_user_role != "admin":
        user_uuid = uuid.UUID(current_user_id)
        if current_user_role == "client":
            # Clients can only access RFQs where they are the client
            if rfq.client_id != user_uuid:
                raise NotFoundException(
                    resource="RFQ",
                    resource_id=rfq_id,
                )
        elif current_user_role == "agent":
            # Agents can access RFQs assigned to them OR unassigned open RFQs
            if rfq.agent_id != user_uuid and not (
                rfq.agent_id is None and rfq.status == RFQStatus.OPEN
            ):
                raise NotFoundException(
                    resource="RFQ",
                    resource_id=rfq_id,
                )
    return rfq


async def list_rfqs(
    db: AsyncSession,
    pagination: PaginationParams,
    agent_id: Optional[str] = None,
    client_id: Optional[str] = None,
    status: Optional[RFQStatus] = None,
) -> RFQListResponse:
    """List RFQs with role-scoped filtering and pagination.

    Args:
        db: Database session.
        pagination: Pagination parameters.
        agent_id: Filter by assigned agent (agents see own + unassigned open).
        client_id: Filter by owning client (clients see only their own).
        status: Optional filter by status.

    Returns:
        Paginated RFQ list response.
    """
    query = select(RFQ)

    if client_id:
        # Client scope: only RFQs owned by this client
        query = query.where(RFQ.client_id == uuid.UUID(client_id))
    elif agent_id:
        # Agent scope: assigned RFQs OR unassigned open RFQs
        agent_uuid = uuid.UUID(agent_id)
        query = query.where(
            (RFQ.agent_id == agent_uuid)
            | ((RFQ.agent_id.is_(None)) & (RFQ.status == RFQStatus.OPEN))
        )
    # Admin: no filter — full table access

    if status:
        query = query.where(RFQ.status == status)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Fetch page
    query = (
        query.order_by(RFQ.created_at.desc())
        .offset(pagination.skip)
        .limit(pagination.limit)
    )
    result = await db.execute(query)
    rfqs = result.scalars().all()

    return RFQListResponse(
        items=[RFQResponse.model_validate(r) for r in rfqs],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
        total_pages=max(1, (total + pagination.page_size - 1) // pagination.page_size),
    )


async def update_rfq_status(
    db: AsyncSession,
    rfq_id: str,
    new_status: RFQStatus,
) -> RFQ:
    """Update the status of an RFQ.

    Args:
        db: Database session.
        rfq_id: RFQ UUID string.
        new_status: Target status.

    Returns:
        Updated RFQ instance.

    Raises:
        NotFoundException: If RFQ not found.
        ValidationError: If status transition is invalid.
    """
    rfq = await get_rfq(db, rfq_id)

    # Basic state machine validation
    valid_transitions = {
        RFQStatus.OPEN: [RFQStatus.PROCESSING, RFQStatus.CANCELLED],
        RFQStatus.PROCESSING: [RFQStatus.QUOTED, RFQStatus.CLOSED, RFQStatus.CANCELLED],
        RFQStatus.QUOTED: [RFQStatus.CLOSED],
        RFQStatus.CLOSED: [],
        RFQStatus.CANCELLED: [],
    }

    allowed = valid_transitions.get(rfq.status, [])
    if new_status not in allowed:
        raise ValidationError(
            message=f"Cannot transition from {rfq.status.value} to {new_status.value}",
            details={
                "current_status": rfq.status.value,
                "requested_status": new_status.value,
                "allowed_transitions": [s.value for s in allowed],
            },
        )

    rfq.status = new_status
    await db.flush()
    await db.refresh(rfq)
    return rfq


# ═══════════════════════════════════════════════════════════
# Products
# ═══════════════════════════════════════════════════════════

async def add_product(
    db: AsyncSession,
    rfq_id: str,
    name: str,
    quantity: int,
    specifications: Optional[str] = None,
    target_price: Optional[float] = None,
    extracted_metadata: Optional[dict] = None,
) -> Product:
    """Add a product to an RFQ.

    Args:
        db: Database session.
        rfq_id: RFQ UUID string.
        name: Product name (must be non-empty).
        quantity: Product quantity (must be > 0).
        specifications: Optional technical specifications.
        target_price: Optional target/budget price.
        extracted_metadata: Optional extracted data from documents.

    Returns:
        Created Product instance.

    Raises:
        NotFoundException: If RFQ not found.
        ValidationError: If name is empty or quantity <= 0.
    """
    # Validate inputs
    if not name or not name.strip():
        raise ValidationError(
            message="Product name is required and cannot be empty",
            details={"field": "name"},
        )
    if quantity < 1:
        raise ValidationError(
            message="Product quantity must be at least 1",
            details={"field": "quantity", "value": quantity},
        )

    # Verify RFQ exists
    await get_rfq(db, rfq_id)

    product = Product(
        rfq_id=uuid.UUID(rfq_id),
        name=name.strip(),
        quantity=quantity,
        specifications=specifications,
        target_price=target_price,
        extracted_metadata=extracted_metadata,
        status=ProductStatus.PENDING,
    )
    db.add(product)
    await db.flush()
    await db.refresh(product)
    return product


async def list_products(
    db: AsyncSession,
    rfq_id: str,
) -> list[Product]:
    """List all products for an RFQ.

    Args:
        db: Database session.
        rfq_id: RFQ UUID string.

    Returns:
        List of Product instances.
    """
    # Verify RFQ exists
    await get_rfq(db, rfq_id)

    result = await db.execute(
        select(Product)
        .where(Product.rfq_id == uuid.UUID(rfq_id))
        .order_by(Product.created_at.asc())
    )
    return list(result.scalars().all())
