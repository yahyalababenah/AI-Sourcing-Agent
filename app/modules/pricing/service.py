"""
AI-Sourcing Hub — Pricing Service Layer

Business logic for managing pricing rules and running calculations.
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import uuid
from typing import Optional

from redis.asyncio import Redis
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.pricing.cache import (
    get_cached_rules,
    get_cached_exchange_rate,
    get_exchange_rate,
    set_cached_rules,
    set_cached_exchange_rate,
    set_exchange_rate,
    invalidate_rules_cache,
    invalidate_exchange_rate,
    RULES_CACHE_LOCK_KEY,
    REBUILD_LOCK_TTL,
)
from app.modules.pricing.engine import PricingEngine, LineItemInput
from app.modules.pricing.models import (
    HSCodeFeeSchedule,
    PricingRule,
    PricingRuleCategory,
    PricingRuleStatus,
)
from app.modules.pricing.schemas import (
    CalculatePriceRequest,
    CalculatePriceResponse,
    HSCodeFeeScheduleCreate,
    HSCodeFeeScheduleListResponse,
    HSCodeFeeScheduleResponse,
    LineItemResult,
    PricingRuleCreate,
    PricingRuleListResponse,
    PricingRuleResponse,
)
from app.shared.exceptions import NotFoundException, ValidationError
from app.shared.logging import get_logger

logger = get_logger(__name__)


# ═══════════════════════════════════════════════════════════
# Pricing Rules CRUD
# ═══════════════════════════════════════════════════════════

async def create_pricing_rule(
    db: AsyncSession,
    rule_data: PricingRuleCreate,
) -> PricingRule:
    """Create a new pricing rule.

    Args:
        db: Database session.
        rule_data: Pricing rule creation data.

    Returns:
        Created PricingRule instance.
    """
    rule = PricingRule(
        name=rule_data.name,
        description=rule_data.description,
        category=PricingRuleCategory(rule_data.category),
        rule_type=rule_data.rule_type,
        value=rule_data.value,
        currency=rule_data.currency,
        conditions=rule_data.conditions,
        priority=rule_data.priority,
        is_active=rule_data.is_active,
    )
    db.add(rule)
    await db.flush()
    await db.refresh(rule)
    return rule


async def get_pricing_rule(
    db: AsyncSession,
    rule_id: str,
) -> PricingRule:
    """Get a pricing rule by ID.

    Args:
        db: Database session.
        rule_id: Rule UUID string.

    Returns:
        PricingRule instance.

    Raises:
        NotFoundException: If rule not found.
    """
    result = await db.execute(
        select(PricingRule).where(PricingRule.id == uuid.UUID(rule_id))
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise NotFoundException(
            resource="Pricing rule",
            resource_id=rule_id,
        )
    return rule


async def list_pricing_rules(
    db: AsyncSession,
    category: Optional[PricingRuleCategory] = None,
    active_only: bool = False,
) -> PricingRuleListResponse:
    """List pricing rules with optional filtering.

    Args:
        db: Database session.
        category: Optional category filter.
        active_only: If True, only return active rules.

    Returns:
        PricingRuleListResponse.
    """
    query = select(PricingRule)

    if category:
        query = query.where(PricingRule.category == category)
    if active_only:
        query = query.where(PricingRule.is_active.is_(True))

    query = query.order_by(PricingRule.priority.asc(), PricingRule.name.asc())
    result = await db.execute(query)
    rules = list(result.scalars().all())

    return PricingRuleListResponse(
        items=[PricingRuleResponse.model_validate(r) for r in rules],
        total=len(rules),
    )


async def update_pricing_rule(
    db: AsyncSession,
    rule_id: str,
    update_data: dict,
) -> PricingRule:
    """Update a pricing rule.

    Args:
        db: Database session.
        rule_id: Rule UUID string.
        update_data: Fields to update.

    Returns:
        Updated PricingRule instance.
    """
    rule = await get_pricing_rule(db, rule_id)

    for key, value in update_data.items():
        if hasattr(rule, key) and value is not None:
            setattr(rule, key, value)

    rule.version += 1
    await db.flush()
    await db.refresh(rule)
    return rule


async def delete_pricing_rule(
    db: AsyncSession,
    rule_id: str,
) -> None:
    """Delete a pricing rule.

    Args:
        db: Database session.
        rule_id: Rule UUID string.
    """
    rule = await get_pricing_rule(db, rule_id)
    await db.delete(rule)
    await db.flush()


# ═══════════════════════════════════════════════════════════
# HS-Code Fee Schedules CRUD
# ═══════════════════════════════════════════════════════════

async def create_hs_code_schedule(
    db: AsyncSession,
    data: HSCodeFeeScheduleCreate,
) -> HSCodeFeeSchedule:
    """Create a new HS-Code fee schedule entry.

    Args:
        db: Database session.
        data: HS-Code fee schedule creation data.

    Returns:
        Created HSCodeFeeSchedule instance.

    Raises:
        ValidationError: If an entry for this HS code already exists.
    """
    existing = await db.execute(
        select(HSCodeFeeSchedule).where(HSCodeFeeSchedule.hs_code == data.hs_code)
    )
    if existing.scalar_one_or_none():
        raise ValidationError(message=f"HS code '{data.hs_code}' already exists")

    entry = HSCodeFeeSchedule(
        hs_code=data.hs_code,
        description=data.description,
        duty_rate_001=data.duty_rate_001,
        service_flat_fee_301=data.service_flat_fee_301,
        service_percent_070=data.service_percent_070,
        requires_license=data.requires_license,
        penalty_rate_018=data.penalty_rate_018,
        is_verified=data.is_verified,
        source_note=data.source_note,
    )
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return entry


async def get_hs_code_schedule(
    db: AsyncSession,
    hs_code: str,
) -> HSCodeFeeSchedule:
    """Get an HS-Code fee schedule by its HS code.

    Args:
        db: Database session.
        hs_code: HS code string.

    Returns:
        HSCodeFeeSchedule instance.

    Raises:
        NotFoundException: If no schedule exists for this HS code.
    """
    result = await db.execute(
        select(HSCodeFeeSchedule).where(HSCodeFeeSchedule.hs_code == hs_code)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise NotFoundException(resource="HS-Code fee schedule", resource_id=hs_code)
    return entry


async def list_hs_code_schedules(db: AsyncSession) -> HSCodeFeeScheduleListResponse:
    """List all HS-Code fee schedules.

    Args:
        db: Database session.

    Returns:
        HSCodeFeeScheduleListResponse.
    """
    result = await db.execute(select(HSCodeFeeSchedule).order_by(HSCodeFeeSchedule.hs_code.asc()))
    entries = list(result.scalars().all())
    return HSCodeFeeScheduleListResponse(
        items=[HSCodeFeeScheduleResponse.model_validate(e) for e in entries],
        total=len(entries),
    )


async def update_hs_code_schedule(
    db: AsyncSession,
    hs_code: str,
    update_data: dict,
) -> HSCodeFeeSchedule:
    """Update an HS-Code fee schedule.

    Args:
        db: Database session.
        hs_code: HS code string.
        update_data: Fields to update.

    Returns:
        Updated HSCodeFeeSchedule instance.
    """
    entry = await get_hs_code_schedule(db, hs_code)

    # hs_code is the resource's identifying key (part of the URL path) — never
    # let the request body silently rename it.
    update_data.pop("hs_code", None)

    for key, value in update_data.items():
        if hasattr(entry, key) and value is not None:
            setattr(entry, key, value)

    await db.flush()
    await db.refresh(entry)
    return entry


async def delete_hs_code_schedule(db: AsyncSession, hs_code: str) -> None:
    """Delete an HS-Code fee schedule.

    Args:
        db: Database session.
        hs_code: HS code string.
    """
    entry = await get_hs_code_schedule(db, hs_code)
    await db.delete(entry)
    await db.flush()


async def _load_hs_code_schedule(
    db: AsyncSession,
    hs_code: str,
) -> Optional[dict]:
    """Load a single HS-Code fee schedule as a plain dict for the engine.

    Direct DB query — no Redis caching yet (small, infrequently-changed table;
    can be added later following the ``_load_rules_for_engine`` pattern if needed).

    Args:
        db: Database session.
        hs_code: HS code to look up.

    Returns:
        Dict of fee schedule fields, or None if not found.
    """
    result = await db.execute(
        select(HSCodeFeeSchedule).where(HSCodeFeeSchedule.hs_code == hs_code)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        return None
    return {
        "duty_rate_001": entry.duty_rate_001,
        "service_flat_fee_301": entry.service_flat_fee_301,
        "service_percent_070": entry.service_percent_070,
        "requires_license": entry.requires_license,
        "penalty_rate_018": entry.penalty_rate_018,
    }


# ═══════════════════════════════════════════════════════════
# Load Rules for Engine
# ═══════════════════════════════════════════════════════════

async def _load_rules_for_engine(
    db: AsyncSession,
    redis: Optional[Redis] = None,
) -> dict[str, float]:
    """Load active pricing rules from cache or DB.

    Args:
        db: Database session.
        redis: Optional Redis client for caching.

    Returns:
        Dict of rule_name → value.
    """
    import asyncio

    # Try cache first
    lock_acquired = False
    if redis:
        cached = await get_cached_rules(redis)
        if cached:
            logger.debug("Loaded pricing rules from cache")
            return cached

        # Cache miss — acquire rebuild lock to prevent stampede
        lock_acquired = bool(
            await redis.set(RULES_CACHE_LOCK_KEY, "1", nx=True, ex=REBUILD_LOCK_TTL)
        )
        if not lock_acquired:
            # Another worker is rebuilding — wait briefly and re-read cache
            await asyncio.sleep(0.2)
            cached = await get_cached_rules(redis)
            if cached:
                logger.debug("Loaded pricing rules from cache (after lock wait)")
                return cached
            # Still None — proceed to DB query below

    # Fall back to DB
    try:
        result = await db.execute(
            select(PricingRule).where(
                PricingRule.is_active.is_(True),
                PricingRule.status == PricingRuleStatus.ACTIVE,
            )
        )
        db_rules = list(result.scalars().all())

        rules_dict: dict[str, float] = {}
        for rule in db_rules:
            rules_dict[rule.name] = rule.value

        # Cache if Redis available
        if redis and rules_dict:
            await set_cached_rules(redis, rules_dict)
            logger.debug("Loaded pricing rules from DB and cached")

        return rules_dict
    finally:
        if redis and lock_acquired:
            await redis.delete(RULES_CACHE_LOCK_KEY)


# ═══════════════════════════════════════════════════════════
# Price Calculation
# ═══════════════════════════════════════════════════════════

async def calculate_price(
    db: AsyncSession,
    request: CalculatePriceRequest,
    redis: Optional[Redis] = None,
) -> CalculatePriceResponse:
    """Run full pricing calculation.

    Args:
        db: Database session.
        request: Price calculation request.
        redis: Optional Redis client for caching.

    Returns:
        CalculatePriceResponse with line items and totals.

    Raises:
        ValidationError: If input validation fails.
    """
    # Load rules from DB/cache
    rules_override = await _load_rules_for_engine(db, redis=redis)

    # Try to get exchange rate with auto-fetch (cache → API fallback)
    if redis:
        rate = await get_exchange_rate(
            redis, "CNY", request.target_currency
        )
        if rate is not None:
            # Store in rules_override so engine uses it
            if request.target_currency.upper() == "JOD":
                rules_override["exchange_rate_cny_jod"] = rate
            elif request.target_currency.upper() == "USD":
                rules_override["exchange_rate_cny_usd"] = rate

    # Initialize engine
    engine = PricingEngine(rules_override=rules_override)

    # Build line item inputs
    # FIX: weight_kg was previously never passed through, so freight was always
    # computed off a phantom 0.1 CBM minimum regardless of actual product weight.
    products = []
    for p in request.products:
        hs_entry = await _load_hs_code_schedule(db, p.hs_code) if p.hs_code else None
        products.append(
            LineItemInput(
                product_id=p.product_id,
                product_name=p.name,
                quantity=p.quantity,
                unit_price_cny=p.unit_price_cny,
                weight_kg=p.weight_kg,
                hs_entry=hs_entry,
                has_license=p.has_license,
            )
        )

    # Run calculation
    result = engine.calculate(
        rfq_id=request.rfq_id,
        target_currency=request.target_currency,
        destination_port=request.destination_port,
        products=products,
    )

    # Cache exchange rate for next time (via set_exchange_rate)
    if redis:
        await set_exchange_rate(
            redis, "CNY", request.target_currency, result["exchange_rate_used"]
        )

    # Build response — line items may contain clearance_fee from new engine
    line_items = []
    for li in result["line_items"]:
        line_items.append(LineItemResult(**li))

    return CalculatePriceResponse(
        rfq_id=result["rfq_id"],
        target_currency=result["target_currency"],
        exchange_rate_used=result["exchange_rate_used"],
        line_items=line_items,
        subtotal_before_vat=result.get("subtotal_before_vat", 0.0),
        vat=result.get("vat", 0.0),
        early_payment_discount=result.get("early_payment_discount", 0.0),
        grand_total=result["grand_total"],
        discount_total=result["discount_total"],
        rules_applied=result["rules_applied"],
    )


# ═══════════════════════════════════════════════════════════
# Exchange Rate Refresh
# ═══════════════════════════════════════════════════════════

async def refresh_exchange_rates(
    db: AsyncSession,
    redis: Optional[Redis] = None,
) -> dict[str, float]:
    """Fetch latest exchange rates from external API and cache them.

    Uses exchangerate-api.com or similar service configured via EXCHANGE_RATE_API_KEY.

    Returns:
        Dict of currency_pair → rate.
    """
    import httpx

    from app.config import settings

    rates: dict[str, float] = {}

    if not settings.EXCHANGE_RATE_API_KEY:
        logger.warning("No EXCHANGE_RATE_API_KEY configured, using defaults")
        return rates

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Fetch CNY→JOD
            response = await client.get(
                f"https://v6.exchangerate-api.com/v6/{settings.EXCHANGE_RATE_API_KEY}/pair/CNY/JOD"
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("result") == "success":
                    rates["CNY_JOD"] = data["conversion_rate"]

            # Fetch CNY→USD
            response = await client.get(
                f"https://v6.exchangerate-api.com/v6/{settings.EXCHANGE_RATE_API_KEY}/pair/CNY/USD"
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("result") == "success":
                    rates["CNY_USD"] = data["conversion_rate"]

    except Exception as exc:
        logger.error("Failed to refresh exchange rates", extra={"error": str(exc)})
        return rates

    # Cache the rates
    if redis and rates:
        for pair, rate in rates.items():
            from_c, to_c = pair.split("_")
            await set_cached_exchange_rate(redis, from_c, to_c, rate)

    logger.info("Exchange rates refreshed", extra={"rates": rates})
    return rates
