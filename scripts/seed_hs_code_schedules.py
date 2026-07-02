#!/usr/bin/env python3
"""
AI-Sourcing Hub — Seed HS-Code Fee Schedules

Inserts the one verified HS-Code fee schedule into the database.
Run after `alembic upgrade head`.

IMPORTANT: Only add entries here that are verified against a real Jordan
Customs (JCAP) tax-simulation result. Do NOT invent customs figures — any
unverified HS code should be left for a real user to enter via the admin
management UI, with is_verified=False.

Usage:
    python -m scripts.seed_hs_code_schedules
"""
# ═══════════════════════════════════════════════════════════
# Imports
# ═══════════════════════════════════════════════════════════
import asyncio

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.modules.pricing.models import HSCodeFeeSchedule


# ═══════════════════════════════════════════════════════════
# Verified HS-Code Fee Schedules
# ═══════════════════════════════════════════════════════════

VERIFIED_ENTRIES = [
    {
        "hs_code": "85241210000",
        "description": "Verified reference HS code from a real JCAP tax simulation",
        "duty_rate_001": 10,
        "service_flat_fee_301": 50,
        "service_percent_070": 5,
        "requires_license": True,
        "penalty_rate_018": 2.5,
        "is_verified": True,
        "source_note": "نتيجة محاكاة ضريبية حقيقية على JCAP بتاريخ 2026-07-01",
    },
]


# ═══════════════════════════════════════════════════════════
# Seed
# ═══════════════════════════════════════════════════════════

async def seed():
    """Insert verified HS-Code fee schedules into the database."""
    engine = create_async_engine(settings.db_url, echo=True)
    session_factory = async_sessionmaker(engine, class_=AsyncSession)

    async with session_factory() as session:
        for entry_data in VERIFIED_ENTRIES:
            entry = HSCodeFeeSchedule(**entry_data)
            session.add(entry)

        await session.commit()
        print(f"✓ Seeded {len(VERIFIED_ENTRIES)} HS-Code fee schedule(s) successfully.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
