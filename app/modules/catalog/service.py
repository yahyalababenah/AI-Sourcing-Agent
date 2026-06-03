"""
AI-Sourcing Hub — Global Catalog Service

Aggregates AI-extracted product items from all suppliers' documents into
a unified, searchable B2B marketplace catalog.
"""

import math
import uuid
from typing import Any, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.auth.models import SupplierProfile, User, UserRole
from app.modules.documents.models import Document, DocumentStatus
from app.modules.catalog.schemas import (
    CatalogListResponse,
    CatalogProductResponse,
)

# ── Module-level logger ──
from app.shared.logging import get_logger

logger = get_logger(__name__)


async def search_catalog(
    db: AsyncSession,
    *,
    q: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> CatalogListResponse:
    """Search the global product catalog across all suppliers.

    Iterates all documents with successfully extracted entities, flattens
    their product lists, and applies optional full-text search filtering
    on ``product_name`` and ``model_number``.

    Args:
        db: Database session.
        q: Optional search term (matched against product name / model).
        page: 1-indexed page number.
        page_size: Items per page (max 100).

    Returns:
        Paginated catalog listing.
    """
    # ── 1. Fetch all extracted documents with supplier info ──
    stmt = (
        select(Document)
        .options(
            selectinload(Document.uploaded_by).selectinload(
                User.supplier_profile
            ),
        )
        .where(
            Document.status == DocumentStatus.EXTRACTED,
            Document.extracted_entities.isnot(None),
        )
        .order_by(Document.updated_at.desc())
    )
    result = await db.execute(stmt)
    documents = result.scalars().all()

    # ── 2. Flatten products from all documents ──
    all_products: list[dict[str, Any]] = []
    for doc in documents:
        supplier: Optional[User] = doc.uploaded_by
        if not supplier or supplier.role != UserRole.AGENT:
            continue  # Skip documents not owned by a supplier

        profile: Optional[SupplierProfile] = supplier.supplier_profile
        products: list[dict[str, Any]] = (doc.extracted_entities or {}).get(
            "products", []
        )
        if not products:
            continue

        for idx, prod in enumerate(products):
            product_name = (prod.get("product_name") or "").strip()
            model_number = (prod.get("model_number") or "").strip()

            entry: dict[str, Any] = {
                "id": f"{doc.id}-{idx}",
                "product_name": product_name or None,
                "model_number": model_number or None,
                "unit_price_rmb": prod.get("unit_price_rmb"),
                "moq": prod.get("moq"),
                "weight_kg": prod.get("weight_kg"),
                "dimensions": prod.get("dimensions"),
                "material": prod.get("material"),
                "supplier_id": supplier.id,
                "supplier_name": supplier.full_name,
                "factory_name": profile.factory_name if profile else None,
                "location_in_china": profile.location_in_china
                if profile
                else None,
                "document_id": doc.id,
                "document_file_name": doc.file_name,
                "extracted_at": doc.updated_at,
            }
            all_products.append(entry)

    # ── 3. Apply search filter ──
    if q:
        q_lower = q.strip().lower()
        all_products = [
            p
            for p in all_products
            if (
                (p["product_name"] and q_lower in p["product_name"].lower())
                or (
                    p["model_number"]
                    and q_lower in p["model_number"].lower()
                )
            )
        ]

    total = len(all_products)
    total_pages = max(1, math.ceil(total / page_size))
    skip = (page - 1) * page_size
    page_items = all_products[skip : skip + page_size]

    return CatalogListResponse(
        items=[CatalogProductResponse(**p) for p in page_items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
