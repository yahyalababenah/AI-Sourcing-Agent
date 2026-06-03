"""
AI-Sourcing Hub — Intake Endpoints

/api/v1/intake/translate    POST   Translate Arabic → Chinese + extract entities
/api/v1/intake/rfqs         POST   Create a new RFQ (role-aware, with client_id)
/api/v1/intake/rfqs         GET    List RFQs (role-scoped: client/agent/admin)
/api/v1/intake/rfqs/{id}    GET    Get RFQ details (ownership-enforced 404)
/api/v1/intake/rfqs/{id}/status PUT  Update RFQ status (agent/admin only)
/api/v1/intake/rfqs/{id}/products POST  Add product to RFQ (agent/admin only)
/api/v1/intake/rfqs/{id}/products GET   List products in RFQ
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.dependencies import get_current_user, require_agent_or_admin
from app.modules.auth.models import User, UserRole
from app.modules.intake.models import RFQStatus
from app.modules.intake.schemas import (
    ClientRFQCreate,
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

    Role-aware ownership:
    - Clients: Creates RFQ with client_id = current_user.id, agent_id = None.
    - Agents: Creates RFQ with agent_id = current_user.id, client_id from request.
    - Admins: Creates RFQ with agent_id = current_user.id.
    """
    if current_user.role == UserRole.CLIENT:
        # Clients use the restricted schema — strip agent-only fields
        client_data = ClientRFQCreate(**rfq_data.model_dump())
        rfq = await create_rfq(
            db,
            client_data,
            agent_id=None,
            client_id=str(current_user.id),
        )
    else:
        # Agents and admins use the full schema
        rfq = await create_rfq(
            db,
            rfq_data,
            agent_id=str(current_user.id),
            client_id=None,
        )
    return RFQResponse.model_validate(rfq)


@router.get(
    "/rfqs",
    response_model=RFQListResponse,
    summary="List RFQs (role-scoped)",
)
async def list_rfqs_endpoint(
    pagination: PaginationParams = Depends(),
    status: Optional[RFQStatus] = Query(None, description="Filter by status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List RFQs with role-based data isolation scoping.

    - Admin: Sees all RFQs across the system.
    - Agent: Sees assigned RFQs + unassigned open RFQs.
    - Client: Sees only RFQs they created (client_id == current_user.id).
    """
    user_id = str(current_user.id)
    if current_user.role == UserRole.CLIENT:
        return await list_rfqs(
            db,
            pagination=pagination,
            client_id=user_id,
            status=status,
        )
    elif current_user.role == UserRole.AGENT:
        return await list_rfqs(
            db,
            pagination=pagination,
            agent_id=user_id,
            status=status,
        )
    # Admin: no filter — full access
    return await list_rfqs(
        db,
        pagination=pagination,
        status=status,
    )


@router.get(
    "/rfqs/{rfq_id}",
    response_model=RFQResponse,
    summary="Get RFQ details (ownership-enforced)",
)
async def get_rfq_endpoint(
    rfq_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get detailed information about a specific RFQ.

    Enforces data isolation: returns 404 if the user does not have
    access to the requested RFQ (hides existence from unauthorized users).
    """
    rfq = await get_rfq(
        db,
        rfq_id,
        current_user_id=str(current_user.id),
        current_user_role=str(current_user.role.value),
    )
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
    current_user: User = Depends(get_current_user),
):
    """List all products associated with an RFQ.

    Enforces data isolation — the RFQ access check is done via get_rfq.
    """
    # Verify the user has access to the parent RFQ first
    await get_rfq(
        db,
        rfq_id,
        current_user_id=str(current_user.id),
        current_user_role=str(current_user.role.value),
    )
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
