#!/usr/bin/env python3
"""
AI-Sourcing Hub — Seed Pricing Rules

Inserts the 16 standard pricing rules into the database.
Run after `alembic upgrade head`.

Usage:
    python -m scripts.seed_pricing_rules
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import asyncio
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.modules.pricing.models import PricingRule, PricingRuleCategory, PricingRuleStatus


# ═══════════════════════════════════════════════════════════
# Default Rules
# ═══════════════════════════════════════════════════════════

DEFAULT_RULES = [
    # ── Exchange Rates ──
    {
        "name": "exchange_rate_cny_jod",
        "description": "CNY to JOD exchange rate",
        "category": PricingRuleCategory.EXCHANGE_RATE,
        "rule_type": "fixed",
        "value": 0.077,
        "priority": 1,
    },
    {
        "name": "exchange_rate_cny_usd",
        "description": "CNY to USD exchange rate",
        "category": PricingRuleCategory.EXCHANGE_RATE,
        "rule_type": "fixed",
        "value": 0.14,
        "priority": 2,
    },
    # ── Freight ──
    {
        "name": "freight_aqaba_20ft",
        "description": "Freight cost to Aqaba port (20ft container, USD)",
        "category": PricingRuleCategory.FREIGHT,
        "rule_type": "fixed",
        "value": 1200.0,
        "currency": "USD",
        "conditions": {"port": "aqaba", "container": "20ft"},
        "priority": 3,
    },
    {
        "name": "freight_aqaba_40ft",
        "description": "Freight cost to Aqaba port (40ft container, USD)",
        "category": PricingRuleCategory.FREIGHT,
        "rule_type": "fixed",
        "value": 2000.0,
        "currency": "USD",
        "conditions": {"port": "aqaba", "container": "40ft"},
        "priority": 4,
    },
    {
        "name": "freight_beirut_20ft",
        "description": "Freight cost to Beirut port (20ft container, USD)",
        "category": PricingRuleCategory.FREIGHT,
        "rule_type": "fixed",
        "value": 1000.0,
        "currency": "USD",
        "conditions": {"port": "beirut", "container": "20ft"},
        "priority": 5,
    },
    {
        "name": "freight_beirut_40ft",
        "description": "Freight cost to Beirut port (40ft container, USD)",
        "category": PricingRuleCategory.FREIGHT,
        "rule_type": "fixed",
        "value": 1800.0,
        "currency": "USD",
        "conditions": {"port": "beirut", "container": "40ft"},
        "priority": 6,
    },
    # ── Customs ──
    {
        "name": "customs_duty_rate_general",
        "description": "General customs duty rate (5% for most goods)",
        "category": PricingRuleCategory.CUSTOMS,
        "rule_type": "percentage",
        "value": 0.05,
        "priority": 7,
    },
    {
        "name": "customs_duty_rate_reduced",
        "description": "Reduced customs duty rate (0% for exempt goods)",
        "category": PricingRuleCategory.CUSTOMS,
        "rule_type": "percentage",
        "value": 0.0,
        "priority": 8,
    },
    # ── Commission ──
    {
        "name": "commission_rate_standard",
        "description": "Standard agent commission (3%)",
        "category": PricingRuleCategory.COMMISSION,
        "rule_type": "percentage",
        "value": 0.03,
        "priority": 9,
    },
    {
        "name": "commission_rate_premium",
        "description": "Premium agent commission for high-value deals (5%)",
        "category": PricingRuleCategory.COMMISSION,
        "rule_type": "percentage",
        "value": 0.05,
        "priority": 10,
    },
    # ── MOQ Discounts ──
    {
        "name": "moq_discount_1000_plus",
        "description": "2% discount for orders of 1,000+ units",
        "category": PricingRuleCategory.MOQ_DISCOUNT,
        "rule_type": "percentage",
        "value": 0.02,
        "conditions": {"min_quantity": 1000},
        "priority": 11,
    },
    {
        "name": "moq_discount_5000_plus",
        "description": "5% discount for orders of 5,000+ units",
        "category": PricingRuleCategory.MOQ_DISCOUNT,
        "rule_type": "percentage",
        "value": 0.05,
        "conditions": {"min_quantity": 5000},
        "priority": 12,
    },
    {
        "name": "moq_discount_10000_plus",
        "description": "8% discount for orders of 10,000+ units",
        "category": PricingRuleCategory.MOQ_DISCOUNT,
        "rule_type": "percentage",
        "value": 0.08,
        "conditions": {"min_quantity": 10000},
        "priority": 13,
    },
    # ── Tax ──
    {
        "name": "vat_rate",
        "description": "Value Added Tax rate (Jordan standard 16%)",
        "category": PricingRuleCategory.TAX,
        "rule_type": "percentage",
        "value": 0.16,
        "priority": 14,
    },
    # ── Other ──
    {
        "name": "early_payment_discount",
        "description": "Early payment discount (2%)",
        "category": PricingRuleCategory.OTHER,
        "rule_type": "percentage",
        "value": 0.02,
        "priority": 15,
    },
    {
        "name": "target_margin",
        "description": "Target profit margin (15%)",
        "category": PricingRuleCategory.MARGIN,
        "rule_type": "percentage",
        "value": 0.15,
        "priority": 16,
    },
]


# ═══════════════════════════════════════════════════════════
# Seed
# ═══════════════════════════════════════════════════════════

async def seed():
    """Insert default pricing rules into the database."""
    engine = create_async_engine(settings.db_url, echo=True)
    session_factory = async_sessionmaker(engine, class_=AsyncSession)

    async with session_factory() as session:
        for rule_data in DEFAULT_RULES:
            rule = PricingRule(
                id=uuid.uuid4(),
                name=rule_data["name"],
                description=rule_data.get("description"),
                category=rule_data["category"],
                rule_type=rule_data["rule_type"],
                value=rule_data["value"],
                currency=rule_data.get("currency"),
                conditions=rule_data.get("conditions"),
                priority=rule_data.get("priority", 0),
                is_active=True,
                status=PricingRuleStatus.ACTIVE,
                version=1,
            )
            session.add(rule)

        await session.commit()
        print(f"✓ Seeded {len(DEFAULT_RULES)} pricing rules successfully.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
