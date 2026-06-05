"""
AI-Sourcing Hub — Intake Endpoints

/api/v1/intake/translate    POST   Translate Arabic → Chinese + extract entities
/api/v1/intake/rfqs         POST   Create a new RFQ (role-aware, with client_id)
/api/v1/intake/rfqs         GET    List RFQs (role-scoped: client/agent/admin)
/api/v1/intake/rfqs/{id}    GET    Get RFQ details (ownership-enforced 404)
/api/v1/intake/rfqs/{id}/status PUT  Update RFQ status (agent/admin only)
/api/v1/intake/rfqs/{id}/products POST  Add product to RFQ (agent/admin only)
/api/v1/intake/rfqs/{id}/products GET   List products in RFQ
/api/v1/intake/rfqs/{id}/match    POST  Run matching algorithm (agent/admin)
/api/v1/intake/rfqs/matched        GET   Supplier's exclusive matches (agent only)
/api/v1/intake/rfqs/public         GET   Public pool RFQs (authenticated)
/api/v1/intake/matches/{id}/claim  POST  Respond to exclusive match (agent only)
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.dependencies import (
    get_current_user,
    require_agent,
    require_agent_or_admin,
)
from app.modules.auth.models import User, UserRole
from app.modules.intake.models import MatchStatus, RFQStatus
from app.modules.intake.schemas import (
    ClaimMatchRequest,
    ClientRFQCreate,
    ProductResponse,
    ProductsBatchRequest,
    ProductsBatchResponse,
    RFQBatchRequest,
    RFQBatchResponse,
    RFQCreate,
    RFQListResponse,
    RFQMatchListResponse,
    RFQMatchResponse,
    RFQResponse,
    TranslateRequest,
    TranslateResponse,
)
from app.modules.intake.service import (
    add_product,
    claim_match,
    create_rfq,
    get_rfq,
    list_matched_rfqs_for_supplier,
    list_products,
    list_products_by_rfq_ids,
    list_public_rfqs,
    list_rfqs,
    list_rfqs_by_ids,
    run_matching,
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
    supplier_id: Optional[str] = Query(
        None,
        description="Filter by supplier agent (use 'me' for current user)",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List RFQs with role-based data isolation scoping.

    - Admin: Sees all RFQs across the system.
    - Agent: Sees assigned RFQs + unassigned open RFQs.
    - Client: Sees only RFQs they created (client_id == current_user.id).

    The `supplier_id` query param provides an alias for agent-scoped filtering,
    primarily used by the Supplier RFQ Inbox frontend. Use `supplier_id=me`
    to scope to the current authenticated user as the supplier/agent.
    """
    user_id = str(current_user.id)

    # supplier_id=me is an alias for agent-scoped listing
    if supplier_id == "me":
        return await list_rfqs(
            db,
            pagination=pagination,
            agent_id=user_id,
            status=status,
        )

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
    response_model=ProductResponse,
    summary="Add product to RFQ",
)
async def add_product_endpoint(
    rfq_id: str,
    name: str = Query(..., description="Product name"),
    quantity: int = Query(..., ge=1, description="Product quantity"),
    specifications: Optional[str] = Query(None, description="Technical specs"),
    target_price: Optional[float] = Query(None, description="Client target/budget price"),
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
        target_price=target_price,
    )
    return product


@router.get(
    "/rfqs/{rfq_id}/products",
    response_model=list[ProductResponse],
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
            "target_price": p.target_price,
            "extracted_metadata": p.extracted_metadata,
            "status": p.status.value,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in products
    ]


# ═══════════════════════════════════════════════════════════
# Batch endpoints (eliminate N+1 frontend queries)
# ═══════════════════════════════════════════════════════════


@router.post(
    "/rfqs/batch",
    response_model=RFQBatchResponse,
    summary="Batch-fetch RFQs by IDs",
)
async def batch_rfqs_endpoint(
    body: RFQBatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Batch-fetch multiple RFQs in a single request.
    Eliminates N+1 queries when the frontend needs details for many RFQs at once.
    """
    ids = [str(id_) for id_ in body.ids]
    rfq_map = await list_rfqs_by_ids(db, ids)
    items: dict[str, RFQResponse] = {}
    for id_, rfq in rfq_map.items():
        items[id_] = RFQResponse.model_validate(rfq)
    return RFQBatchResponse(items=items)


@router.post(
    "/rfqs/products/batch",
    response_model=ProductsBatchResponse,
    summary="Batch-fetch products for multiple RFQs",
)
async def batch_products_endpoint(
    body: ProductsBatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Batch-fetch products for multiple RFQs in a single request.
    Eliminates N+1 queries when the frontend needs products for many RFQs at once.
    """
    rfq_ids = [str(id_) for id_ in body.rfq_ids]
    products_map = await list_products_by_rfq_ids(db, rfq_ids)
    items: dict[str, list[ProductResponse]] = {}
    for rfq_id_str, products in products_map.items():
        items[rfq_id_str] = [
            ProductResponse(
                id=p.id,
                rfq_id=p.rfq_id,
                name=p.name,
                quantity=p.quantity,
                specifications=p.specifications,
                target_price=p.target_price,
                extracted_metadata=p.extracted_metadata,
                status=p.status.value,
                created_at=p.created_at,
            )
            for p in products
        ]
    return ProductsBatchResponse(items=items)


# ═══════════════════════════════════════════════════════════
# RFQ Matching Engine
# ═══════════════════════════════════════════════════════════


@router.post(
    "/rfqs/{rfq_id}/match",
    response_model=list[RFQMatchResponse],
    status_code=201,
    summary="Run matching algorithm for an RFQ",
)
async def run_matching_endpoint(
    rfq_id: str,
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_agent_or_admin),
):
    """Trigger the hybrid matching algorithm for an RFQ.

    Scans supplier catalogs and profiles to find the best matches,
    creates RFQMatch records with a 3-hour exclusive window.

    Restricted to agents and admins.
    """
    matches = await run_matching(db, rfq_id)
    return [RFQMatchResponse.model_validate(m) for m in matches]


@router.get(
    "/rfqs/matched",
    response_model=RFQMatchListResponse,
    summary="List exclusive-matched RFQs for the current supplier",
)
async def list_matched_rfqs_endpoint(
    pagination: PaginationParams = Depends(),
    status: Optional[MatchStatus] = Query(
        None,
        description="Filter by match status (pending | responded | expired | declined)",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_agent),
):
    """List RFQ matches assigned to the authenticated supplier.

    Shows the supplier's exclusive 3-hour window matches.
    Only accessible by agents (suppliers).
    """
    return await list_matched_rfqs_for_supplier(
        db,
        supplier_id=str(current_user.id),
        pagination=pagination,
        status_filter=status,
    )


@router.get(
    "/rfqs/public",
    response_model=RFQListResponse,
    summary="List public pool RFQs (expired exclusive windows)",
)
async def list_public_rfqs_endpoint(
    pagination: PaginationParams = Depends(),
    status: Optional[RFQStatus] = Query(
        None,
        description="Filter by RFQ status (defaults to OPEN only)",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List RFQs in the public pool.

    These are RFQs whose exclusive matching window has expired
    or had no direct matches, now visible to all authenticated suppliers.
    """
    return await list_public_rfqs(
        db,
        pagination=pagination,
        status=status,
    )


@router.post(
    "/matches/{match_id}/claim",
    response_model=RFQMatchResponse,
    summary="Respond to an exclusive match (claim or decline)",
)
async def claim_match_endpoint(
    match_id: str,
    body: ClaimMatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_agent),
):
    """Respond to a matched RFQ within the exclusive window.

    - `respond`: Accept the match and proceed to pricing/quoting.
    - `decline`: Reject the match, freeing it for other suppliers.

    Enforces ownership: only the matched supplier can respond.
    Validates status is PENDING and deadline has not passed.

    Restricted to agents (suppliers).
    """
    match = await claim_match(
        db,
        match_id=match_id,
        supplier_id=str(current_user.id),
        action=body.action,
    )
    return RFQMatchResponse.model_validate(match)
