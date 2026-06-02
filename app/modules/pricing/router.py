"""
AI-Sourcing Hub — Pricing Endpoints

/api/v1/pricing/rules            GET    List pricing rules
/api/v1/pricing/rules            POST   Create pricing rule
/api/v1/pricing/rules/{id}       GET    Get rule details
/api/v1/pricing/rules/{id}       PUT    Update pricing rule
/api/v1/pricing/rules/{id}       DELETE Delete pricing rule
/api/v1/pricing/calculate        POST   Run price calculation
/api/v1/pricing/exchange-rates   POST   Refresh exchange rates
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
from typing import Optional

from fastapi import APIRouter, Depends, Query
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.dependencies import require_admin, require_agent_or_admin
from app.modules.auth.models import User
from app.modules.pricing.models import PricingRuleCategory
from app.modules.pricing.schemas import (
    CalculatePriceRequest,
    CalculatePriceResponse,
    PricingRuleCreate,
    PricingRuleListResponse,
    PricingRuleResponse,
)
from app.modules.pricing.service import (
    calculate_price,
    create_pricing_rule,
    delete_pricing_rule,
    get_pricing_rule,
    list_pricing_rules,
    refresh_exchange_rates,
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
):
    """List all pricing rules, optionally filtered by category or active status."""
    return await list_pricing_rules(db, category=category, active_only=active_only)


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
