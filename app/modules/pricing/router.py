"""
AI-Sourcing Hub — Pricing Endpoints

/api/v1/pricing/rules              GET    List pricing rules
/api/v1/pricing/rules              POST   Create pricing rule
/api/v1/pricing/rules/{id}         GET    Get rule details
/api/v1/pricing/rules/{id}         PUT    Update pricing rule
/api/v1/pricing/rules/{id}         DELETE Delete pricing rule
/api/v1/pricing/rules/{id}/history GET    Get rule change history
/api/v1/pricing/hs-codes           GET    List HS-Code fee schedules
/api/v1/pricing/hs-codes           POST   Create HS-Code fee schedule
/api/v1/pricing/hs-codes/{code}    PUT    Update HS-Code fee schedule
/api/v1/pricing/hs-codes/{code}    DELETE Delete HS-Code fee schedule
/api/v1/pricing/calculate          POST   Run price calculation
/api/v1/pricing/exchange-rates     POST   Refresh exchange rates
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
from typing import Optional

from fastapi import APIRouter, Depends, Query
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.dependencies import get_current_user, require_admin, require_agent_or_admin
from app.modules.auth.models import User
from app.modules.pricing.models import PricingRuleCategory
from app.modules.pricing.schemas import (
    CalculatePriceRequest,
    CalculatePriceResponse,
    HSCodeFeeScheduleCreate,
    HSCodeFeeScheduleListResponse,
    HSCodeFeeScheduleResponse,
    PricingRuleCreate,
    PricingRuleListResponse,
    PricingRuleResponse,
    QuickEstimateRequest,
    QuickEstimateResponse,
)
from app.modules.pricing.service import (
    calculate_price,
    create_hs_code_schedule,
    create_pricing_rule,
    delete_hs_code_schedule,
    delete_pricing_rule,
    get_pricing_rule,
    list_hs_code_schedules,
    list_pricing_rules,
    refresh_exchange_rates,
    update_hs_code_schedule,
    update_pricing_rule,
)
from app.shared.database import get_db
from app.shared.redis_client import get_redis_client

router = APIRouter()


# ═══════════════════════════════════════════════════════════
# Pricing Rules
# ═══════════════════════════════════════════════════════════

@router.get(
    "/rules",
    response_model=PricingRuleListResponse,
    summary="List pricing rules",
)
async def list_rules(
    category: Optional[PricingRuleCategory] = Query(None, description="Filter by category"),
    active_only: bool = Query(False, description="Only active rules"),
    _current_user: User = Depends(require_agent_or_admin),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_client),
):
    """List all pricing rules, optionally filtered by category or active status."""
    from app.modules.pricing.cache import get_cached_rules_list, set_cached_rules_list
    cat_str = category.value if category else None
    cached = await get_cached_rules_list(redis, cat_str, active_only)
    if cached is not None:
        return cached
    result = await list_pricing_rules(db, category=category, active_only=active_only)
    await set_cached_rules_list(redis, cat_str, active_only, result)
    return result


@router.post(
    "/rules",
    response_model=PricingRuleResponse,
    status_code=201,
    summary="Create pricing rule",
)
async def create_rule(
    rule_data: PricingRuleCreate,
    _current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_client),
):
    """Create a new pricing rule (admin only)."""
    rule = await create_pricing_rule(db, rule_data)
    # Invalidate cache
    from app.modules.pricing.cache import invalidate_rules_cache
    await invalidate_rules_cache(redis)
    return PricingRuleResponse.model_validate(rule)


@router.get(
    "/rules/{rule_id}",
    response_model=PricingRuleResponse,
    summary="Get pricing rule details",
)
async def get_rule(
    rule_id: str,
    _current_user: User = Depends(require_agent_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed information about a pricing rule."""
    rule = await get_pricing_rule(db, rule_id)
    return PricingRuleResponse.model_validate(rule)


@router.put(
    "/rules/{rule_id}",
    response_model=PricingRuleResponse,
    summary="Update pricing rule",
)
async def update_rule(
    rule_id: str,
    rule_data: PricingRuleCreate,
    _current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_client),
):
    """Update an existing pricing rule (admin only)."""
    rule = await update_pricing_rule(db, rule_id, rule_data.model_dump(exclude_unset=True))
    from app.modules.pricing.cache import invalidate_rules_cache
    await invalidate_rules_cache(redis)
    return PricingRuleResponse.model_validate(rule)


@router.get(
    "/rules/{rule_id}/history",
    summary="Get pricing rule change history",
)
async def get_rule_history(
    rule_id: str,
    _current_user: User = Depends(require_agent_or_admin),
):
    """Get audit history for a pricing rule.

    NOTE: The audit log table is planned for Phase 5 (Security Hardening).
    Currently returns an empty list with a placeholder message.

    Once the audit middleware is implemented, this endpoint will return
    a chronological list of changes to this rule including:
      - Previous value → new value
      - Changed by (user_id)
      - Timestamp of change
    """
    return {
        "rule_id": rule_id,
        "history": [],
        "message": "Audit logging is planned for Phase 5. This endpoint will be fully implemented once the audit table is available.",
    }


@router.delete(
    "/rules/{rule_id}",
    status_code=204,
    summary="Delete pricing rule",
)
async def delete_rule(
    rule_id: str,
    _current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_client),
):
    """Delete a pricing rule (admin only)."""
    await delete_pricing_rule(db, rule_id)
    from app.modules.pricing.cache import invalidate_rules_cache
    await invalidate_rules_cache(redis)


# ═══════════════════════════════════════════════════════════
# HS-Code Fee Schedules
# ═══════════════════════════════════════════════════════════

@router.get(
    "/hs-codes",
    response_model=HSCodeFeeScheduleListResponse,
    summary="List HS-Code fee schedules",
)
async def list_hs_codes(
    _current_user: User = Depends(require_agent_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all HS-Code fee schedules."""
    return await list_hs_code_schedules(db)


@router.post(
    "/hs-codes",
    response_model=HSCodeFeeScheduleResponse,
    status_code=201,
    summary="Create HS-Code fee schedule",
)
async def create_hs_code(
    data: HSCodeFeeScheduleCreate,
    _current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new HS-Code fee schedule entry (admin only)."""
    entry = await create_hs_code_schedule(db, data)
    return HSCodeFeeScheduleResponse.model_validate(entry)


@router.put(
    "/hs-codes/{code}",
    response_model=HSCodeFeeScheduleResponse,
    summary="Update HS-Code fee schedule",
)
async def update_hs_code(
    code: str,
    data: HSCodeFeeScheduleCreate,
    _current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing HS-Code fee schedule entry (admin only)."""
    entry = await update_hs_code_schedule(db, code, data.model_dump(exclude_unset=True))
    return HSCodeFeeScheduleResponse.model_validate(entry)


@router.delete(
    "/hs-codes/{code}",
    status_code=204,
    summary="Delete HS-Code fee schedule",
)
async def delete_hs_code(
    code: str,
    _current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete an HS-Code fee schedule entry (admin only)."""
    await delete_hs_code_schedule(db, code)


# ═══════════════════════════════════════════════════════════
# Price Calculation
# ═══════════════════════════════════════════════════════════

@router.post(
    "/calculate",
    response_model=CalculatePriceResponse,
    summary="Run price calculation",
)
async def calculate(
    request: CalculatePriceRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_client),
    _current_user: User = Depends(require_agent_or_admin),
):
    """Calculate pricing for an RFQ including exchange rates, freight, customs, etc."""
    return await calculate_price(db, request, redis=redis)


# ═══════════════════════════════════════════════════════════
# Quick Estimate (all authenticated users — marketplace)
# ═══════════════════════════════════════════════════════════

@router.post(
    "/estimate",
    response_model=QuickEstimateResponse,
    summary="Quick landed-cost estimate for marketplace browsing",
)
async def quick_estimate(
    request: QuickEstimateRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_client),
    _current_user: User = Depends(get_current_user),
):
    """Return an estimated landed cost (FOB + customs + VAT, no shipping).

    Accessible to all authenticated users so clients can see the cost
    breakdown before submitting a formal RFQ.
    """
    calc_request = CalculatePriceRequest(
        rfq_id="estimate",
        target_currency=request.target_currency,
        destination_port=request.destination_port,
        has_license=request.has_license,
        volume_cbm=request.volume_cbm,
        products=[{
            "product_id": "estimate",
            "name": "Estimate",
            "quantity": request.quantity,
            "unit_price_cny": request.unit_price_cny,
            "weight_kg": request.weight_kg,
            "hs_code": request.hs_code,
            "has_license": request.has_license,
            "volume_cbm": request.volume_cbm,
        }],
    )
    result = await calculate_price(db, calc_request, redis=redis)
    line = result.line_items[0] if result.line_items else None
    lv = lambda k: getattr(line, k, 0) if line else 0
    # 301 is charged once per shipment (not per line item — see engine.calculate),
    # so it's read off the top-level result, not the line item.
    service_flat_301 = result.service_flat_fee_301_total
    subtotal = (
        lv("unit_price_converted") * request.quantity
        + lv("customs_duty")
        + lv("clearance_fee")
        + lv("commission")
        + service_flat_301
        + lv("service_percent_070")
        + lv("penalty_018")
    )
    return QuickEstimateResponse(
        unit_price_cny=request.unit_price_cny,
        quantity=request.quantity,
        exchange_rate=result.exchange_rate_used,
        target_currency=request.target_currency,
        unit_price_converted=lv("unit_price_converted"),
        insurance_cost=lv("insurance_cost"),
        cif_value=lv("cif_value"),
        customs_duty=lv("customs_duty"),
        clearance_fee=lv("clearance_fee"),
        subtotal_excl_shipping=subtotal,
        vat=result.vat,
        estimated_total=result.grand_total,
        service_flat_301=service_flat_301,
        service_percent_070=lv("service_percent_070"),
        penalty_018=lv("penalty_018"),
        hs_code_matched=lv("hs_code_matched") or False,
    )


# ═══════════════════════════════════════════════════════════
# Exchange Rates
# ═══════════════════════════════════════════════════════════

@router.post(
    "/exchange-rates/refresh",
    summary="Refresh exchange rates",
)
async def refresh_rates(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis_client),
    _current_user: User = Depends(require_admin),
):
    """Manually trigger exchange rate refresh from external API."""
    rates = await refresh_exchange_rates(db, redis=redis)
    return {"status": "ok", "rates": rates}
