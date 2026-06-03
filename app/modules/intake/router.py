"""
AI-Sourcing Hub — Intake Endpoints

/api/v1/intake/translate    POST   Translate Arabic → Chinese + extract entities
/api/v1/intake/rfqs         POST   Create a new RFQ (clients, agents, admins)
/api/v1/intake/rfqs         GET    List RFQs (paginated, filterable, role-scoped)
/api/v1/intake/rfqs/{id}    GET    Get RFQ details
/api/v1/intake/rfqs/{id}/status PUT  Update RFQ status (agent/admin only)
/api/v1/intake/rfqs/{id}/products POST  Add product to RFQ (agent/admin only)
/api/v1/intake/rfqs/{id}/products GET   List products in RFQ
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.dependencies import get_current_user, require_agent_or_admin
from app.modules.auth.models import User
from app.modules.intake.models import RFQStatus
from app.modules.intake.schemas import (
    RFQCreate,
    RFQResponse,
    RFQListResponse,
    TranslateRequest,
    TranslateResponse,
)
from app.modules.intake.service import (
    add_product,
    create_rfq,
    get_rfq,
    list_products,
    list_rfqs,
    translate_request,
    update_rfq_status,
)
from app.shared.database import get_db
from app.shared.pagination import PaginationParams

router = APIRouter()


# ═══════════════════════════════════════════════════════════
# Translation
# ═══════════════════════════════════════════════════════════

@router.post(
    "/translate",
    response_model=TranslateResponse,
    summary="Translate Arabic → Chinese and extract entities",
)
async def translate(
    request: TranslateRequest,
    provider: Optional[str] = Query(
        None,
        description="LLM provider override (together | openrouter)",
    ),
    _current_user: User = Depends(require_agent_or_admin),
):
    """Translate an Arabic client request to Chinese and extract product entities.

    Restricted to agents and admins — clients cannot directly access translation.
    """
    result = await translate_request(request.raw_text, provider=provider)
    return TranslateResponse(
        request_id=result["request_id"],
        chinese_query=result["chinese_query"],
        entities=result["entities"],
        confidence=result["confidence"],
    )


# ═══════════════════════════════════════════════════════════
# RFQ CRUD
# ═══════════════════════════════════════════════════════════

@router.post(
    "/rfqs",
    response_model=RFQResponse,
    status_code=201,
    summary="Create a new RFQ",
)
async def create_rfq_endpoint(
    rfq_data: RFQCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new Request for Quotation.

    Accessible by all authenticated users:
    - Clients: Creates RFQ with their own user ID as the creator.
    - Agents: Creates RFQ for a client with their agent ID.
    - Admins: Creates RFQ with their admin ID.
    """
    rfq = await create_rfq(db, rfq_data, agent_id=str(current_user.id))
    return RFQResponse.model_validate(rfq)


@router.get(
    "/rfqs",
    response_model=RFQListResponse,
    summary="List RFQs",
)
async def list_rfqs_endpoint(
    pagination: PaginationParams = Depends(),
    status: Optional[RFQStatus] = Query(None, description="Filter by status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List RFQs with pagination and optional status filter.

    Role-based scoping:
    - Admin: Sees all RFQs across the system.
    - Agent: Sees only RFQs assigned to them.
    - Client: Sees only RFQs they created (their user ID is stored as agent_id).
    """
    # Admin sees all; agents and clients see only their own
    user_id = str(current_user.id) if current_user.role != "admin" else None
    return await list_rfqs(
        db,
        pagination=pagination,
        agent_id=user_id,
        status=status,
    )


@router.get(
    "/rfqs/{rfq_id}",
    response_model=RFQResponse,
    summary="Get RFQ details",
)
async def get_rfq_endpoint(
    rfq_id: str,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Get detailed information about a specific RFQ.

    Any authenticated user can view RFQ details.
    """
    rfq = await get_rfq(db, rfq_id)
    return RFQResponse.model_validate(rfq)


@router.put(
    "/rfqs/{rfq_id}/status",
    response_model=RFQResponse,
    summary="Update RFQ status",
)
async def update_rfq_status_endpoint(
    rfq_id: str,
    new_status: RFQStatus,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_agent_or_admin),
):
    """Transition an RFQ to a new status (validates state machine).

    Restricted to agents and admins — clients cannot change RFQ status.
    """
    rfq = await update_rfq_status(db, rfq_id, new_status)
    return RFQResponse.model_validate(rfq)


# ═══════════════════════════════════════════════════════════
# Products
# ═══════════════════════════════════════════════════════════

@router.post(
    "/rfqs/{rfq_id}/products",
    status_code=201,
    summary="Add product to RFQ",
)
async def add_product_endpoint(
    rfq_id: str,
    name: str = Query(..., description="Product name"),
    quantity: int = Query(..., ge=1, description="Product quantity"),
    specifications: Optional[str] = Query(None, description="Technical specs"),
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_agent_or_admin),
):
    """Add a product line item to an RFQ.

    Restricted to agents and admins — part of the sourcing workflow.
    """
    product = await add_product(
        db,
        rfq_id=rfq_id,
        name=name,
        quantity=quantity,
        specifications=specifications,
    )
    return {
        "id": str(product.id),
        "rfq_id": rfq_id,
        "name": product.name,
        "quantity": product.quantity,
        "specifications": product.specifications,
        "status": product.status.value,
    }


@router.get(
    "/rfqs/{rfq_id}/products",
    summary="List products in RFQ",
)
async def list_products_endpoint(
    rfq_id: str,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """List all products associated with an RFQ.

    Any authenticated user can view products in an RFQ.
    """
    products = await list_products(db, rfq_id)
    return [
        {
            "id": str(p.id),
            "rfq_id": rfq_id,
            "name": p.name,
            "quantity": p.quantity,
            "specifications": p.specifications,
            "status": p.status.value,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in products
    ]
