"""
AI-Sourcing Hub — Global Catalog Endpoints

/api/v1/catalog/products    GET    Browse the global B2B marketplace catalog
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.dependencies import get_current_user, require_any_role
from app.modules.auth.models import User, UserRole
from app.modules.catalog.schemas import CatalogListResponse, CatalogProductResponse
from app.modules.catalog.service import (
    search_catalog,
    list_pending_products,
    review_product,
)
from app.modules.catalog.models import ProductReviewStatus
from app.shared.database import get_db
from app.shared.pagination import PaginationParams
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


@router.get(
    "/products",
    response_model=CatalogListResponse,
    summary="Browse global product catalog",
    description=(
        "Returns a paginated, searchable list of all AI-extracted products "
        "from uploaded supplier documents. Clients can search by product "
        "name or model number, and filter by category, price range, or supplier."
    ),
)
async def list_catalog_products(
    q: str = Query(
        None,
        min_length=1,
        max_length=200,
        description="Full-text search term — matched against product name and model number",
    ),
    category: str = Query(
        None,
        min_length=1,
        max_length=100,
        description="Filter by product category (also matches against material field)",
    ),
    min_price: float = Query(
        None,
        ge=0,
        description="Minimum unit price in RMB (inclusive)",
    ),
    max_price: float = Query(
        None,
        ge=0,
        description="Maximum unit price in RMB (inclusive)",
    ),
    supplier_id: UUID = Query(
        None,
        description="Filter by supplier (agent) UUID",
    ),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_any_role(UserRole.CLIENT, UserRole.AGENT, UserRole.ADMIN)),
):
    """Browse all globally available products from suppliers."""
    return await search_catalog(
        db,
        q=q,
        category=category,
        min_price=min_price,
        max_price=max_price,
        supplier_id=supplier_id,
        page=pagination.page,
        page_size=pagination.page_size,
    )


# ── Review Models ──

class ProductReviewRequest(BaseModel):
    action: str  # "approve" | "reject"
    product_name: Optional[str] = None
    model_number: Optional[str] = None
    unit_price_rmb: Optional[float] = None
    moq: Optional[int] = None
    weight_kg: Optional[float] = None
    dimensions: Optional[str] = None
    material: Optional[str] = None
    category: Optional[str] = None


# ── Review Endpoints (Agent/Admin only) ──

@router.get(
    "/products/pending",
    response_model=CatalogListResponse,
    summary="List products pending agent review",
)
async def pending_products(
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_any_role(UserRole.AGENT, UserRole.ADMIN)),
):
    return await list_pending_products(
        db,
        supplier_id=current_user.id,
        page=pagination.page,
        page_size=pagination.page_size,
    )


@router.patch(
    "/products/{product_id}/review",
    response_model=CatalogProductResponse,
    summary="Approve or reject an extracted product",
)
async def review_product_endpoint(
    product_id: UUID,
    body: ProductReviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_any_role(UserRole.AGENT, UserRole.ADMIN)),
):
    status = (
        ProductReviewStatus.APPROVED
        if body.action == "approve"
        else ProductReviewStatus.REJECTED
    )
    updates = {k: v for k, v in body.model_dump().items() if k != "action" and v is not None}
    product = await review_product(
        db,
        product_id=product_id,
        supplier_id=current_user.id,
        status=status,
        updates=updates or None,
    )
    return CatalogProductResponse(
        id=str(product.id),
        product_name=product.product_name,
        model_number=product.model_number,
        unit_price_rmb=product.unit_price_rmb,
        moq=product.moq,
        weight_kg=product.weight_kg,
        dimensions=product.dimensions,
        material=product.material,
        category=product.category,
        supplier_id=product.supplier_id,
        extracted_at=product.updated_at,
    )
