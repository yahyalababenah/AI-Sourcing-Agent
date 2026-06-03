"""
AI-Sourcing Hub — Global Catalog Endpoints

/api/v1/catalog/products    GET    Browse the global B2B marketplace catalog
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.dependencies import get_current_user, require_client_or_admin
from app.modules.auth.models import User
from app.modules.catalog.schemas import CatalogListResponse
from app.modules.catalog.service import search_catalog
from app.shared.database import get_db
from app.shared.pagination import PaginationParams

router = APIRouter()


@router.get(
    "/products",
    response_model=CatalogListResponse,
    summary="Browse global product catalog",
    description=(
        "Returns a paginated, searchable list of all AI-extracted products "
        "from uploaded supplier documents. Clients can search by product "
        "name or model number."
    ),
)
async def list_catalog_products(
    q: str = Query(
        None,
        min_length=1,
        max_length=200,
        description="Full-text search term — matched against product name and model number",
    ),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_client_or_admin),
):
    """Browse all globally available products from suppliers."""
    return await search_catalog(
        db,
        q=q,
        page=pagination.page,
        page_size=pagination.page_size,
    )
