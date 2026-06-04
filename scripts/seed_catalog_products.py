#!/usr/bin/env python3
"""Seed the new catalog_products table with demo data using direct SQL.

Usage:
    cd /home/yahia/Desktop/ai-sourcing-hub
    docker compose exec -T postgres psql -U app_user -d aisourcing < scripts/seed_catalog_products.sql

Or via API container:
    docker compose exec api python scripts/seed_catalog_products.py

Requires:
    - PostgreSQL running with migration 006 applied
    - Demo users seeded (seed_demo_users.py)
"""

import asyncio
import logging
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.config import settings

logger = logging.getLogger(__name__)

# Direct INSERT using raw SQL to avoid ORM mapper complexity
INSERT_SQL = """
INSERT INTO catalog_products (document_id, supplier_id, product_name, model_number, unit_price_rmb, moq, weight_kg, dimensions, material, category)
SELECT
    d.id AS document_id,
    u.id AS supplier_id,
    v.*
FROM (
    SELECT unnest(ARRAY[
        'مكيف هواء مركزي', 'مضخة مياه غاطسة', 'لوحة تحكم كهربائية', 'محرك كهربائي ثلاثي',
        'حساس ضغط صناعي', 'صمام تحكم هوائي', 'كابل طاقة عالي الجهد', 'وحدة تبريد صناعية',
        'مفتاح تبديل أوتوماتيكي', 'نظام ترشيح مياه', 'مولد كهربائي ديزل', 'بطارية شمسية ليثيوم',
        'محول تيار متردد', 'لوحة طاقة شمسية', 'مضخة طرد مركزي', 'جهاز تحكم منطقي مبرمج',
        'شاشة لمس صناعية', 'مستشعر درجة حرارة', 'صمام كروي', 'مكثف كهربائي',
        'ثلاجة صناعية', 'غلاية مياه صناعية', 'سير ناقل', 'فاصل مغناطيسي',
        'خلاط صناعي', 'ضوء كاشف LED', 'مفتاح ضغط', 'مقياس تدفق',
        'مجفف هواء', 'ضواغط هواء لولبية'
    ]) AS product_name
    , unnest(ARRAY[
        'CAC-7200', 'SP-1500', 'ECP-480', 'IM-220',
        'PT-4-20', 'PV-250', 'HV-33kV', 'ICU-50T',
        'ATS-1600', 'WFS-5000', 'DG-500', 'Li-5kWh',
        'T-100kVA', 'SP-550W', 'CP-3000', 'PLC-D3',
        'HMI-15', 'RTD-PT100', 'BV-200', 'Cap-100uF',
        'CR-1000L', 'WB-500L', 'CB-1200', 'MS-800',
        'IM-500L', 'FL-200W', 'PS-100', 'FM-DN50',
        'AD-200', 'SC-75kW'
    ]) AS model_number
    , unnest(ARRAY[
        4500, 2800, 3200, 5600,
        850, 1800, 120, 22000,
        7500, 9500, 185000, 4500,
        32000, 950, 4200, 3800,
        5200, 250, 650, 45,
        12000, 28000, 15000, 18000,
        13500, 350, 180, 2400,
        8500, 65000
    ])::float8 AS unit_price_rmb
    , unnest(ARRAY[
        10, 20, 5, 10,
        50, 25, 100, 2,
        8, 5, 1, 20,
        3, 50, 15, 10,
        8, 100, 40, 200,
        3, 2, 4, 3,
        5, 60, 80, 15,
        6, 2
    ])::int AS moq
    , unnest(ARRAY[
        85, 45, 22, 120,
        0.5, 8, 2.5, 450,
        35, 180, 2800, 45,
        650, 28, 65, 3.5,
        6, 0.3, 3, 0.1,
        180, 320, 250, 400,
        200, 5, 0.8, 12,
        120, 1200
    ])::float8 AS weight_kg
    , unnest(ARRAY[
        '120x80x180', '30x30x120', '60x40x15', '80x50x50',
        '5x5x10', '40x25x25', '1000x0.5x0.5', '200x150x180',
        '80x60x40', '150x60x120', '350x150x200', '60x40x25',
        '160x100x120', '227x113x3.5', '50x40x80', '25x12x18',
        '40x25x5', '0.5x0.5x10', '20x15x15', '3x2x4',
        '120x80x200', '150x100x180', '500x80x30', '120x80x100',
        '100x100x150', '45x30x10', '8x6x12', '25x20x20',
        '80x50x100', '250x120x180'
    ]) AS dimensions
    , unnest(ARRAY[
        'Steel / Copper', 'Stainless Steel', 'Steel / ABS', 'Cast Iron',
        'Stainless Steel', 'Brass', 'Copper / XLPE', 'Steel / Aluminum',
        'Steel / Copper', 'Stainless Steel', 'Steel / Cast Iron', 'Lithium-ion',
        'Copper / Steel', 'Monocrystalline Silicon', 'Cast Iron', 'ABS Plastic',
        'Aluminum / Glass', 'Stainless Steel', 'Stainless Steel', 'Aluminum / Plastic',
        'Stainless Steel', 'Steel / Copper', 'Rubber / Steel', 'Steel / Magnet',
        'Stainless Steel', 'Aluminum / PC', 'Brass', 'Stainless Steel',
        'Steel', 'Cast Iron / Steel'
    ]) AS material
    , unnest(ARRAY[
        'HVAC', 'Pumps', 'Electrical', 'Motors',
        'Sensors', 'Valves', 'Cables', 'HVAC',
        'Electrical', 'Water Treatment', 'Generators', 'Solar',
        'Transformers', 'Solar', 'Pumps', 'Automation',
        'Automation', 'Sensors', 'Valves', 'Electrical',
        'HVAC', 'Industrial Boilers', 'Conveyors', 'Separation',
        'Mixing', 'Lighting', 'Sensors', 'Flow Measurement',
        'Compressed Air', 'Compressors'
    ]) AS category
) v
CROSS JOIN LATERAL (
    SELECT id FROM users WHERE role = 'agent' LIMIT 1
) u
CROSS JOIN LATERAL (
    SELECT id FROM documents WHERE status = 'extracted' LIMIT 1
) d
WHERE NOT EXISTS (SELECT 1 FROM catalog_products LIMIT 1)
ON CONFLICT DO NOTHING;
"""


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    engine = create_async_engine(settings.db_url, echo=False)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as db:
        # Check if already seeded
        result = await db.execute(text("SELECT COUNT(*) FROM catalog_products"))
        count = result.scalar()
        if count and count > 0:
            logger.info("📊 catalog_products already has %d rows — skipping seed", count)
            await engine.dispose()
            return

        # Check for an extracted document
        result = await db.execute(
            text("SELECT id FROM documents WHERE status = 'extracted' LIMIT 1")
        )
        doc = result.fetchone()
        if not doc:
            logger.info("📄 No extracted documents found — creating a placeholder document")

            # Find supplier for uploaded_by
            result = await db.execute(
                text("SELECT id FROM users WHERE role = 'agent' LIMIT 1")
            )
            agent = result.fetchone()
            if not agent:
                logger.error("❌ No agent user found. Run seed_demo_users.py first!")
                sys.exit(1)

            # Find a demo RFQ to link the document to
            result = await db.execute(
                text("SELECT id FROM rfqs LIMIT 1")
            )
            rfq = result.fetchone()

            if not rfq:
                logger.error("❌ No RFQs found. Run seed_demo_rfqs.py first!")
                sys.exit(1)

            # Create a document manually
            await db.execute(
                text("""
                    INSERT INTO documents (id, rfq_id, uploaded_by_id, file_name, file_path,
                                           content_type, doc_type, status, extracted_text, extracted_entities)
                    VALUES (gen_random_uuid(), :rfq_id, :agent_id, 'seed-catalog-demo.pdf',
                            'seed-catalog-demo.pdf', 'application/pdf', 'pdf', 'extracted',
                            'Seeded demo catalog products', '{"products": []}'::jsonb)
                """),
                {"rfq_id": rfq[0], "agent_id": agent[0]}
            )
            logger.info("✅ Created placeholder document")

        # Now run the insert
        result = await db.execute(text(INSERT_SQL))
        await db.commit()
        logger.info("✅ Seeded %d products into catalog_products", result.rowcount)

        # Verify
        result = await db.execute(text("SELECT COUNT(*) FROM catalog_products"))
        final = result.scalar()
        logger.info("📊 Total catalog_products rows: %d", final)

        # Test full-text search
        result = await db.execute(
            text("""
                SELECT product_name FROM catalog_products
                WHERE search_vector @@ plainto_tsquery('simple', 'مكيف')
                LIMIT 5
            """)
        )
        matches = result.fetchall()
        logger.info("🔍 Full-text search for 'مكيف': %s", [r[0] for r in matches])

        # Test category filter
        result = await db.execute(
            text("""
                SELECT product_name FROM catalog_products
                WHERE category = 'HVAC'
            """)
        )
        hvac = result.fetchall()
        logger.info("🔍 Category=HVAC: %s", [r[0] for r in hvac])

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
