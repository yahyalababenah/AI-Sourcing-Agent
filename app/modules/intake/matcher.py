"""
AI-Sourcing Hub — Targeted RFQ Matching Engine

Implements the hybrid matching algorithm that pairs RFQs with relevant
suppliers based on product catalog categories and supplier profile specialities.

Lifecycle:
    1. RFQ is created / reaches PROCESSING status
    2. Matching engine runs → creates RFQMatch records with 3h exclusive window
    3. Matched suppliers get notified (exclusive window active)
    4. After 3h or all suppliers respond → RFQ opens to public pool
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, func, and_, or_, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import SupplierProfile, User, UserRole
from app.modules.catalog.models import CatalogProduct
from app.modules.intake.models import (
    MatchStatus,
    Product,
    RFQ,
    RFQMatch,
    RFQStatus,
)
from app.shared.categories import CATEGORY_KEYWORD_MAP
from app.shared.exceptions import NotFoundException
from app.shared.logging import get_logger

logger = get_logger(__name__)

# ── Constants ──────────────────────────────────────────────────────────

EXCLUSIVE_WINDOW_HOURS = 3
"""Duration of the exclusive matching window in hours."""

MATCH_SCORE_CATALOG_DIRECT = 0.6
"""Score boost when supplier's catalog has a product in the same category."""

MATCH_SCORE_PROFILE_MATCH = 0.3
"""Score boost when supplier's profile lists the category."""

MATCH_SCORE_OVERLAP_BONUS = 0.1
"""Per overlapping product bonus (max 0.3)."""

MATCH_SCORE_MINIMUM = 0.3
"""Minimum score for a match to be created. Below this = no match."""

MAX_MATCHES_PER_RFQ = 10
"""Maximum number of suppliers to match per RFQ."""


# ═════════════════════════════════════════════════════════════════════
# Category Extraction
# ═════════════════════════════════════════════════════════════════════


def _extract_categories_from_entities(extracted_entities: Optional[dict]) -> set[str]:
    """Extract unique product category names from RFQ's extracted entities.

    Checks these sources (in priority order):
        1. ``products[].hs_code_category`` (from AI translation)
        2. ``products[].category`` (explicit category field)
        3. ``products[].name_arabic`` / ``product_name`` keywords (last resort)

    Args:
        extracted_entities: The RFQ's ``extracted_entities`` JSONB dict.

    Returns:
        Set of lowercase category strings.
    """
    categories: set[str] = set()
    if not extracted_entities:
        return categories

    products = extracted_entities.get("products", [])
    if not products:
        return categories

    for product in products:
        # Priority 1: HS code category from AI extraction
        hs_cat = product.get("hs_code_category", "")
        if hs_cat and isinstance(hs_cat, str):
            categories.add(hs_cat.strip().lower())

        # Priority 2: Explicit category field
        cat = product.get("category", "")
        if cat and isinstance(cat, str):
            categories.add(cat.strip().lower())

    return categories


def _extract_categories_from_db_products(products: list[Product]) -> set[str]:
    """Extract category hints from RFQ's related Product rows.

    Uses ``Product.specifications`` and ``Product.name`` to infer
    broad category buckets via keyword matching.

    Args:
        products: List of Product ORM instances.

    Returns:
        Set of inferred category strings.
    """
    categories: set[str] = set()
    for product in products:
        name = (product.name or "").strip().lower()
        specs = (product.specifications or "").strip().lower()

        # Simple keyword-based category inference
        combined = f"{name} {specs}"

        for keyword, category in CATEGORY_KEYWORD_MAP.items():
            # Use word-boundary matching to avoid false positives like
            # "rice" matching inside "price" or "oil" inside "soil".
            if re.search(rf"\b{re.escape(keyword)}\b", combined):
                categories.add(category)

    return categories


# ═════════════════════════════════════════════════════════════════════
# Matching Algorithm
# ═════════════════════════════════════════════════════════════════════


async def match_rfq_to_suppliers(
    db: AsyncSession,
    rfq_id: str,
) -> list[RFQMatch]:
    """Run the matching algorithm for a given RFQ.

    Algorithm steps:
        1. Fetch RFQ + its extracted entities + products
        2. Extract category signals from entities and DB products
        3. Find suppliers via CatalogProduct.category overlap
        4. Find suppliers via SupplierProfile.product_categories overlap
        5. Score and rank suppliers
        6. Create RFQMatch records with 3h exclusive window
        7. Update RFQ with matched_supplier_ids and exclusive_deadline

    Args:
        db: Database session.
        rfq_id: UUID string of the RFQ to match.

    Returns:
        List of created RFQMatch records.

    Raises:
        NotFoundException: If RFQ not found.
    """
    # ── Step 1: Fetch RFQ ──
    result = await db.execute(
        select(RFQ)
        .where(RFQ.id == rfq_id)
    )
    rfq: RFQ | None = result.scalar_one_or_none()
    if not rfq:
        raise NotFoundException(resource="RFQ", resource_id=rfq_id)

    # ── Step 2: Extract categories ──
    entity_categories = _extract_categories_from_entities(rfq.extracted_entities)

    # Also load related products for keyword-based inference
    prod_result = await db.execute(
        select(Product).where(Product.rfq_id == rfq.id)
    )
    db_products = list(prod_result.scalars().all())
    keyword_categories = _extract_categories_from_db_products(db_products)

    all_categories = entity_categories | keyword_categories

    if not all_categories:
        logger.info(
            "No categories could be extracted for RFQ %s — skipping matching",
            rfq_id,
        )
        return []

    logger.info(
        "Matching RFQ %s with categories: %s",
        rfq_id,
        ", ".join(sorted(all_categories)),
    )

    # ── Step 3: Find suppliers via catalog product categories ──
    # Query distinct supplier_ids whose catalog products match any RFQ category
    catalog_supplier_query = (
        select(distinct(CatalogProduct.supplier_id))
        .where(
            and_(
                func.lower(CatalogProduct.category).in_(
                    [c.lower() for c in all_categories]
                ),
                CatalogProduct.supplier_id.isnot(None),
            )
        )
    )
    catalog_result = await db.execute(catalog_supplier_query)
    catalog_supplier_ids = {row[0] for row in catalog_result.fetchall()}

    # ── Step 4: Find suppliers via profile categories ──
    # Use PostgreSQL JSONB ?| operator to filter product_categories in-database,
    # avoiding loading all profiles into memory.
    all_categories_lower = [c.lower() for c in all_categories]
    profile_result = await db.execute(
        select(SupplierProfile.user_id).where(
            SupplierProfile.product_categories.isnot(None),
            SupplierProfile.product_categories.has_any(all_categories_lower),
        )
    )
    profile_supplier_ids = {row[0] for row in profile_result.all()}

    all_supplier_ids = catalog_supplier_ids | profile_supplier_ids

    if not all_supplier_ids:
        logger.info(
            "No matching suppliers found for RFQ %s",
            rfq_id,
        )
        # Mark as public immediately since no matches
        rfq.is_public = True
        await db.flush()
        return []

    # ── Step 5: Score each supplier ──
    supplier_scores: dict[str, float] = {}
    supplier_reasons: dict[str, list[str]] = {}

    for supplier_id in all_supplier_ids:
        sid_str = str(supplier_id)
        score = 0.0
        reasons: list[str] = []

        # Catalog match score
        if supplier_id in catalog_supplier_ids:
            # Count how many categories overlap
            cat_count_query = (
                select(func.count(distinct(CatalogProduct.category)))
                .where(
                    and_(
                        CatalogProduct.supplier_id == supplier_id,
                        func.lower(CatalogProduct.category).in_(
                            [c.lower() for c in all_categories]
                        ),
                    )
                )
            )
            cat_count_result = await db.execute(cat_count_query)
            overlapping_cats = cat_count_result.scalar() or 0

            if overlapping_cats > 0:
                catalog_score = MATCH_SCORE_CATALOG_DIRECT + (
                    MATCH_SCORE_OVERLAP_BONUS * min(overlapping_cats, 3)
                )
                score += catalog_score
                reasons.append(
                    f"Catalog matches {overlapping_cats} RFQ product categor(ies)"
                )

        # Profile match score
        if supplier_id in profile_supplier_ids:
            score += MATCH_SCORE_PROFILE_MATCH
            reasons.append("Supplier profile lists matching categories")

        supplier_scores[sid_str] = score
        supplier_reasons[sid_str] = reasons

    # ── Step 6: Filter by minimum score, sort, take top N ──
    qualified = [
        (sid, score)
        for sid, score in supplier_scores.items()
        if score >= MATCH_SCORE_MINIMUM
    ]
    qualified.sort(key=lambda x: x[1], reverse=True)
    top_matches = qualified[:MAX_MATCHES_PER_RFQ]

    if not top_matches:
        logger.info(
            "No suppliers met minimum score %.1f for RFQ %s",
            MATCH_SCORE_MINIMUM,
            rfq_id,
        )
        rfq.is_public = True
        await db.flush()
        return []

    # ── Step 7: Create RFQMatch records ──
    now = datetime.now(timezone.utc)
    deadline = now + timedelta(hours=EXCLUSIVE_WINDOW_HOURS)

    match_records: list[RFQMatch] = []
    matched_ids: list[str] = []

    for sid_str, score in top_matches:
        match = RFQMatch(
            rfq_id=rfq.id,
            supplier_id=sid_str,
            match_score=round(score, 4),
            match_reason="; ".join(supplier_reasons.get(sid_str, [])),
            response_deadline=deadline,
            status=MatchStatus.PENDING,
        )
        db.add(match)
        match_records.append(match)
        matched_ids.append(sid_str)

    # ── Step 8: Update RFQ ──
    rfq.matched_supplier_ids = matched_ids
    rfq.exclusive_deadline = deadline
    rfq.is_public = False

    await db.flush()

    logger.info(
        "Matched RFQ %s to %d supplier(s) with %.1fh exclusive window",
        rfq_id,
        len(match_records),
        EXCLUSIVE_WINDOW_HOURS,
    )

    return match_records


# ═════════════════════════════════════════════════════════════════════
# Exclusive Window Expiry / Public Pool
# ═════════════════════════════════════════════════════════════════════


async def open_rfq_to_public_pool(
    db: AsyncSession,
    rfq_id: str,
) -> RFQ:
    """Open an RFQ to the public pool after its exclusive window expires.

    Sets ``RFQ.is_public = True`` and expires all pending matches.

    Args:
        db: Database session.
        rfq_id: UUID string of the RFQ.

    Returns:
        Updated RFQ instance.
    """
    result = await db.execute(select(RFQ).where(RFQ.id == rfq_id))
    rfq: RFQ | None = result.scalar_one_or_none()
    if not rfq:
        raise NotFoundException(resource="RFQ", resource_id=rfq_id)

    rfq.is_public = True

    # Expire all pending matches
    expire_result = await db.execute(
        RFQMatch.__table__.update()
        .where(
            RFQMatch.rfq_id == rfq.id,
            RFQMatch.status == MatchStatus.PENDING,
        )
        .values(status=MatchStatus.EXPIRED)
    )
    expired_count = expire_result.rowcount

    await db.flush()

    logger.info(
        "RFQ %s opened to public pool, expired %d pending matches",
        rfq_id,
        expired_count,
    )

    return rfq


async def expire_stale_matches(
    db: AsyncSession,
) -> int:
    """Batch-expire all RFQMatch records past their deadline.

    Called by Celery scheduler every few minutes.

    Also opens RFQs to public pool once all their matches have expired
    or been responded to.

    Args:
        db: Database session.

    Returns:
        Number of matches expired.
    """
    now = datetime.now(timezone.utc)

    # Expire matches past deadline
    result = await db.execute(
        RFQMatch.__table__.update()
        .where(
            RFQMatch.status == MatchStatus.PENDING,
            RFQMatch.response_deadline.isnot(None),
            RFQMatch.response_deadline <= now,
        )
        .values(status=MatchStatus.EXPIRED)
    )
    expired_count = result.rowcount

    if expired_count > 0:
        logger.info("Expired %d stale RFQ matches", expired_count)

    # Open RFQs to public pool if all their matches are done
    # Find RFQs where:
    #   - is_public = False
    #   - exclusive_deadline <= now OR all matches are non-pending
    public_result = await db.execute(
        RFQ.__table__.update()
        .where(
            RFQ.is_public == False,  # noqa: E712
            RFQ.exclusive_deadline.isnot(None),
            RFQ.exclusive_deadline <= now,
        )
        .values(is_public=True)
    )
    public_count = public_result.rowcount

    if public_count > 0:
        logger.info("Opened %d RFQs to public pool after deadline expiry", public_count)

    await db.flush()
    return expired_count
