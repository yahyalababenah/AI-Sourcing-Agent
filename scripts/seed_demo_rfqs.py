#!/usr/bin/env python3
"""
AI-Sourcing Hub — Seed Demo RFQs

Creates sample RFQs linked to the demo client (client@example.com)
with optional agent assignment for the demo agent (agent@example.com).

- 2 RFQs assigned to the agent (client-owned, agent-handled)
- 1 RFQ unassigned (client-owned, open for any agent to pick up)

This ensures:
  ✓ Client sees their own RFQs in ClientDashboard
  ✓ Agent sees assigned + unassigned open RFQs in AgentDashboard
  ✓ Document upload dropdown has data

Usage:
    python -m scripts.seed_demo_rfqs
"""

import asyncio
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import create_app
from app.modules.auth.models import User, UserRole
from app.modules.intake.models import RFQ, RFQStatus
from app.shared.database import async_session_factory

DEMO_RFQS = [
    {
        "client_name": "شركة الأفق للتجارة",
        "client_phone": "+962791234567",
        "client_request_arabic": "مطلوب 500 طن من حديد التسليح التركي بمواصفات أوروبية، مع شهادة منشأ، التسليم إلى ميناء العقبة",
        "translated_query_chinese": "需要500吨土耳其螺纹钢，欧洲标准，附带原产地证书，交付至亚喀巴港",
        "destination_port": "ميناء العقبة",
        "target_currency": "JOD",
        "assign_to_agent": True,
    },
    {
        "client_name": "مؤسسة النورس",
        "client_phone": "+962792345678",
        "client_request_arabic": "نحتاج 2000 كرتون من التونة المعلبة الصينية، وزن 200 غرام لكل علبة، للتسليم خلال 30 يوماً",
        "translated_query_chinese": "需要2000箱中国金枪鱼罐头，每罐200克，30天内交货",
        "destination_port": "ميناء الحديدة",
        "target_currency": "USD",
        "assign_to_agent": True,
    },
    {
        "client_name": "شركة البناء الحديث",
        "client_phone": "+962793456789",
        "client_request_arabic": "مطلوب 10000 م² من السيراميك البورسلين الصيني مقاس 60×60 سم، لون بيج، درجة أولى",
        "translated_query_chinese": "需要10000平方米中国炻瓷砖，60×60厘米，米色，一级品",
        "destination_port": "ميناء حاويات العقبة",
        "target_currency": "JOD",
        "assign_to_agent": False,  # Unassigned — open for any agent to claim
    },
]


async def seed():
    """Insert demo RFQs linked to the demo client, optionally assigned to the demo agent."""
    app = create_app()

    async with async_session_factory() as session:
        # Find the demo client (RFQ owner)
        client_result = await session.execute(
            select(User).where(User.email == "client@example.com")
        )
        client = client_result.scalar_one_or_none()

        if not client:
            print("❌ Demo client not found (client@example.com). Run seed_demo_users.py first.")
            return

        # Find the demo agent (optional handler)
        agent_result = await session.execute(
            select(User).where(User.email == "agent@example.com")
        )
        agent = agent_result.scalar_one_or_none()

        if not agent:
            print("❌ Demo agent not found (agent@example.com). Run seed_demo_users.py first.")
            return

        created = 0
        skipped = 0

        for rfq_data in DEMO_RFQS:
            # Check if a similar RFQ already exists for this client
            result = await session.execute(
                select(RFQ).where(
                    RFQ.client_id == client.id,
                    RFQ.client_name == rfq_data["client_name"],
                )
            )
            existing = result.scalar_one_or_none()

            if existing:
                print(f"⏭️  RFQ already exists: {rfq_data['client_name']}")
                skipped += 1
                continue

            rfq = RFQ(
                id=uuid.uuid4(),
                client_id=client.id,
                agent_id=agent.id if rfq_data["assign_to_agent"] else None,
                client_name=rfq_data["client_name"],
                client_phone=rfq_data["client_phone"],
                client_request_arabic=rfq_data["client_request_arabic"],
                translated_query_chinese=rfq_data["translated_query_chinese"],
                destination_port=rfq_data["destination_port"],
                target_currency=rfq_data["target_currency"],
                status=RFQStatus.OPEN,
            )
            session.add(rfq)
            created += 1
            assigned_label = f"→ assigned to agent" if rfq_data["assign_to_agent"] else "→ unassigned (open)"
            print(f"✅ Created RFQ for: {rfq_data['client_name']} {assigned_label}")

        await session.commit()
        print(f"\n📊 Summary: {created} created, {skipped} skipped")
        print(f"   Client ID: {client.id}")
        print(f"   Agent ID:  {agent.id}")


if __name__ == "__main__":
    asyncio.run(seed())
