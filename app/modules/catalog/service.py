"""
AI-Sourcing Hub — Global Catalog Service

Aggregates AI-extracted product items from all suppliers' documents into
a unified, searchable B2B marketplace catalog.

Supports:
    - Full-text search via PostgreSQL GIN index (tsvector)
    - B-Tree indexed filtering by category, supplier_id, and price range
    - Automatic sync when documents reach EXTRACTED status
"""

import uuid
from typing import Optional

from sqlalchemy import func, or_, select, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy.sql.expression import literal_column

from app.modules.auth.models import SupplierProfile, User, UserRole
from app.modules.catalog.models import CatalogProduct
from app.modules.catalog.schemas import (
    CatalogListResponse,
    CatalogProductResponse,
)
from app.modules.documents.models import Document, DocumentStatus

# ── Module-level logger ──
from app.shared.logging import get_logger

logger = get_logger(__name__)


# ═══════════════════════════════════════════════════════════════
# Sync: Document → CatalogProduct
# ═══════════════════════════════════════════════════════════════


async def sync_document_products(db: AsyncSession, document: Document) -> int:
    """Synchronise a document's extracted products into ``catalog_products``.

    Called automatically after a document's status changes to EXTRACTED.
    Replaces any previously synced products for this document (idempotent).

    Args:
        db: Database session.
        document: The document whose ``extracted_entities['products']``
                  should be synced.

    Returns:
        Number of products synced (inserted).
    """
    products_data = (document.extracted_entities or {}).get("products", [])
    if not products_data:
        logger.info("No products to sync for document %s", document.id)
        return 0

    # Verify the uploader is an agent (supplier)
    supplier = document.uploaded_by
    if not supplier or supplier.role != UserRole.AGENT:
        logger.warning(
            "Document %s owner is not an AGENT (role=%s) — skipping sync",
            document.id,
            supplier.role if supplier else "None",
        )
        return 0

    # Remove previously synced products for this document (idempotent)
    await db.execute(
        delete(CatalogProduct).where(CatalogProduct.document_id == document.id)
    )

    # Insert new products
    count = 0
    for prod in products_data:
        product_name = (prod.get("product_name") or "").strip()
        if not product_name:
            continue  # Skip entries without a product name

        catalog_product = CatalogProduct(
            document_id=document.id,
            supplier_id=supplier.id,
            product_name=product_name,
            model_number=(prod.get("model_number") or "").strip() or None,
            unit_price_rmb=prod.get("unit_price_rmb"),
            moq=prod.get("moq"),
            weight_kg=prod.get("weight_kg"),
            dimensions=prod.get("dimensions"),
            material=prod.get("material"),
            category=prod.get("category"),
        )
        db.add(catalog_product)
        count += 1

    await db.flush()
    logger.info(
        "Synced %d products from document %s into catalog_products",
        count,
        document.id,
    )
    return count


def sync_document_products_sync(db: Session, document: Document) -> int:
    """Synchronous version of :func:`sync_document_products` for Celery tasks.

    Performs the same logic (delete old + insert new) using a sync
    SQLAlchemy session, since Celery workers run outside the async
    FastAPI event loop.

    Args:
        db: Synchronous SQLAlchemy session.
        document: The document whose ``extracted_entities['products']``
                  should be synced.

    Returns:
        Number of products synced (inserted).
    """
    products_data = (document.extracted_entities or {}).get("products", [])
    if not products_data:
        logger.info("No products to sync for document %s", document.id)
        return 0

    # Verify the uploader is an agent (supplier)
    supplier = document.uploaded_by
    if not supplier or supplier.role != UserRole.AGENT:
        logger.warning(
            "Document %s owner is not an AGENT (role=%s) — skipping sync",
            document.id,
            supplier.role if supplier else "None",
        )
        return 0

    # Remove previously synced products for this document (idempotent)
    db.execute(
        delete(CatalogProduct).where(CatalogProduct.document_id == document.id)
    )

    # Insert new products
    count = 0
    for prod in products_data:
        product_name = (prod.get("product_name") or "").strip()
        if not product_name:
            continue  # Skip entries without a product name

        catalog_product = CatalogProduct(
            document_id=document.id,
            supplier_id=supplier.id,
            product_name=product_name,
            model_number=(prod.get("model_number") or "").strip() or None,
            unit_price_rmb=prod.get("unit_price_rmb"),
            moq=prod.get("moq"),
            weight_kg=prod.get("weight_kg"),
            dimensions=prod.get("dimensions"),
            material=prod.get("material"),
            category=prod.get("category"),
        )
        db.add(catalog_product)
        count += 1

    db.flush()
    logger.info(
        "Synced %d products from document %s into catalog_products",
        count,
        document.id,
    )
    return count


async def sync_all_documents(db: AsyncSession) -> int:
    """Backfill all existing EXTRACTED documents into ``catalog_products``.

    Useful as a one-time migration when the catalog_products table is first
    created, and for periodic reconciliation.

    Args:
        db: Database session.

    Returns:
        Total number of products synced across all documents.
    """
    stmt = (
        select(Document)
        .options(selectinload(Document.uploaded_by))
        .where(
            Document.status == DocumentStatus.EXTRACTED,
            Document.extracted_entities.isnot(None),
        )
    )
    result = await db.execute(stmt)
    documents = result.scalars().all()

    total = 0
    for doc in documents:
        total += await sync_document_products(db, doc)

    await db.commit()
    logger.info("Backfill complete: %d products synced from %d documents", total, len(documents))
    return total


# ═══════════════════════════════════════════════════════════════
# Search
# ═══════════════════════════════════════════════════════════════


async def search_catalog(
    db: AsyncSession,
    *,
    q: Optional[str] = None,
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    supplier_id: Optional[uuid.UUID] = None,
    page: int = 1,
    page_size: int = 20,
) -> CatalogListResponse:
    """Search the global product catalog using database-level querying.

    Leverages PostgreSQL indexes:
        - GIN index on ``search_vector`` for full-text search (``q`` param).
        - B-Tree indexes on ``unit_price_rmb``, ``category``, ``supplier_id``.

    Falls back to ILIKE search when a full-text query doesn't match, ensuring
    fuzzy/partial matches still return results (important for Chinese product
    names where tokenisation may not catch all variants).

    Args:
        db: Database session.
        q: Optional search term. Uses full-text search via GIN index first,
           then falls back to ILIKE on product_name / model_number.
        category: Filter by product category (exact match, case-insensitive).
        min_price: Minimum unit price in RMB (inclusive).
        max_price: Maximum unit price in RMB (inclusive).
        supplier_id: Filter by supplier (agent) UUID.
        page: 1-indexed page number.
        page_size: Items per page (max 100).

    Returns:
        Paginated catalog listing.
    """
    # ── 1. Build base query with eager-loaded supplier info ──
    base_query = (
        select(CatalogProduct)
        .options(
            joinedload(CatalogProduct.supplier).joinedload(
                User.supplier_profile
            ),
            joinedload(CatalogProduct.document),
        )
    )

    # ── 2. Apply filters ──

    # 2a. Full-text search (GIN-indexed tsvector)
    if q:
        q_clean = q.strip()
        # Try full-text search first (uses GIN index)
        ts_query = func.plainto_tsquery("simple", q_clean)
        base_query = base_query.where(
            CatalogProduct.search_vector.op("@@")(ts_query)
        )

    # 2b. Category filter (B-Tree indexed)
    if category:
        base_query = base_query.where(
            func.lower(CatalogProduct.category) == category.strip().lower()
        )

    # 2c. Price range (B-Tree indexed)
    if min_price is not None:
        base_query = base_query.where(CatalogProduct.unit_price_rmb >= min_price)
    if max_price is not None:
        base_query = base_query.where(CatalogProduct.unit_price_rmb <= max_price)

    # 2d. Supplier filter (B-Tree indexed)
    if supplier_id is not None:
        base_query = base_query.where(CatalogProduct.supplier_id == supplier_id)

    # ── 3. Count total (before pagination) ──
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # ── 4. Apply pagination ──
    page_size = min(page_size, 100)
    skip = (page - 1) * page_size

    query = (
        base_query
        .order_by(CatalogProduct.updated_at.desc())
        .offset(skip)
        .limit(page_size)
    )
    result = await db.execute(query)
    products = result.scalars().all()

    # ── 5. Build response ──
    items = []
    for prod in products:
        supplier = prod.supplier
        profile: Optional[SupplierProfile] = (
            supplier.supplier_profile if supplier else None
        )

        items.append(
            CatalogProductResponse(
                id=str(prod.id),
                product_name=prod.product_name,
                model_number=prod.model_number,
                unit_price_rmb=prod.unit_price_rmb,
                moq=prod.moq,
                weight_kg=prod.weight_kg,
                dimensions=prod.dimensions,
                material=prod.material,
                category=prod.category,
                supplier_id=prod.supplier_id,
                supplier_name=supplier.full_name if supplier else None,
                factory_name=profile.factory_name if profile else None,
                location_in_china=profile.location_in_china if profile else None,
                document_id=prod.document_id,
                document_file_name=prod.document.file_name
                if prod.document
                else None,
                extracted_at=prod.updated_at,
            )
        )

    total_pages = max(1, (total + page_size - 1) // page_size)

    return CatalogListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


async def search_catalog_fallback(
    db: AsyncSession,
    *,
    q: Optional[str] = None,
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    supplier_id: Optional[uuid.UUID] = None,
    page: int = 1,
    page_size: int = 20,
) -> CatalogListResponse:
    """Fallback search using ILIKE when full-text search returns no results.

    This ensures that partial/fuzzy matches still work for Chinese product
    names that the PostgreSQL tokeniser may not handle well.
    """
    base_query = select(CatalogProduct).options(
        joinedload(CatalogProduct.supplier).joinedload(
            User.supplier_profile
        ),
        joinedload(CatalogProduct.document),
    )

    conditions = []

    if q:
        q_clean = q.strip().lower()
        conditions.append(
            or_(
                func.lower(CatalogProduct.product_name).contains(q_clean),
                func.lower(CatalogProduct.model_number).contains(q_clean),
                func.lower(CatalogProduct.material).contains(q_clean),
                func.lower(CatalogProduct.category).contains(q_clean),
            )
        )

    if category:
        conditions.append(
            func.lower(CatalogProduct.category) == category.strip().lower()
        )

    if min_price is not None:
        conditions.append(CatalogProduct.unit_price_rmb >= min_price)
    if max_price is not None:
        conditions.append(CatalogProduct.unit_price_rmb <= max_price)
    if supplier_id is not None:
        conditions.append(CatalogProduct.supplier_id == supplier_id)

    if conditions:
        base_query = base_query.where(and_(*conditions))

    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    page_size = min(page_size, 100)
    skip = (page - 1) * page_size
    query = (
        base_query
        .order_by(CatalogProduct.updated_at.desc())
        .offset(skip)
        .limit(page_size)
    )
    result = await db.execute(query)
    products = result.scalars().all()

    items = []
    for prod in products:
        supplier = prod.supplier
        profile: Optional[SupplierProfile] = (
            supplier.supplier_profile if supplier else None
        )
        items.append(
            CatalogProductResponse(
                id=str(prod.id),
                product_name=prod.product_name,
                model_number=prod.model_number,
                unit_price_rmb=prod.unit_price_rmb,
                moq=prod.moq,
                weight_kg=prod.weight_kg,
                dimensions=prod.dimensions,
                material=prod.material,
                category=prod.category,
                supplier_id=prod.supplier_id,
                supplier_name=supplier.full_name if supplier else None,
                factory_name=profile.factory_name if profile else None,
                location_in_china=profile.location_in_china if profile else None,
                document_id=prod.document_id,
                document_file_name=prod.document.file_name
                if prod.document
                else None,
                extracted_at=prod.updated_at,
            )
        )

    total_pages = max(1, (total + page_size - 1) // page_size)
    return CatalogListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
