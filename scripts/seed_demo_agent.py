#!/usr/bin/env python3
"""
AI-Sourcing Hub — Seed Demo Agent (sales-rep demo account)

Builds one complete, realistic "agent" (China-side supplier rep) demo
persona for a live product demo, covering the full RFQ → Quote → Order
lifecycle plus a chat conversation:

  - 1 agent user (verified supplier profile, industrial lighting/electrical
    specialty in Guangzhou) + 1 dedicated client user (Jordanian contractor).
  - 5 RFQs in 5 different states:
      A) OPEN       — brand-new, not reviewed yet
      B) PROCESSING — agent currently reviewing/building a quote
      C) QUOTED     — quotation built, PDF generated, sent to client
      D) QUOTED     — quotation accepted by client, order tracking in progress
      E) OPEN       — deliberately unmatchable category (aviation parts),
                      to exercise the "no match found" empty state
  - 1 fully-calculated quotation (RFQ C) with a real PDF generated via the
    live API (exercises the actual pricing engine + WeasyPrint pipeline).
  - 1 chat room (tied to RFQ C) with 7 back-and-forth messages.

Idempotent: safe to re-run. Requires the API to be reachable at
API_BASE_URL (default http://localhost:8000) — the quote/PDF/tracking
steps go through the real HTTP endpoints, not direct DB writes, so this
script also doubles as a smoke test of that pipeline.

Usage:
    python -m scripts.seed_demo_agent
"""

import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import httpx
from sqlalchemy import select

from app.main import create_app
from app.modules.auth.models import ClientProfile, SupplierProfile, User, UserRole, VerificationStatus
from app.modules.catalog.models import CatalogProduct, ProductReviewStatus
from app.modules.chat.models import ChatMessage, ChatRoom
from app.modules.documents.models import Document, DocumentStatus, DocumentType
from app.modules.intake.models import RFQ, Product, RFQStatus
from app.shared.database import async_session_factory

API_BASE_URL = os.environ.get("SEED_API_BASE_URL", "http://localhost:8000")
API_V1 = f"{API_BASE_URL}/api/v1"

AGENT_EMAIL = "sales.rep@aisourcing.demo"
AGENT_PASSWORD = "Demo@Aqaba2026!"
CLIENT_EMAIL = "contractor@aisourcing.demo"
CLIENT_PASSWORD = "Demo@Aqaba2026!"


# ═══════════════════════════════════════════════════════════
# Step 1 — Users
# ═══════════════════════════════════════════════════════════

async def ensure_user(session, *, email, password, full_name, role, phone) -> User:
    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        print(f"⏭️  User already exists: {email}")
        return user

    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user = User(
        id=uuid.uuid4(),
        email=email,
        password_hash=password_hash,
        full_name=full_name,
        role=role,
        phone=phone,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    print(f"✅ Created user: {email} ({role.value})")
    return user


async def ensure_supplier_profile(session, user: User) -> None:
    result = await session.execute(select(SupplierProfile).where(SupplierProfile.user_id == user.id))
    if result.scalar_one_or_none():
        return
    session.add(
        SupplierProfile(
            id=uuid.uuid4(),
            user_id=user.id,
            factory_name="قوانغتشو للإضاءة والمعدات الكهربائية الصناعية",
            location_in_china="Guangzhou, Guangdong",
            specialty="إضاءة صناعية ومعدات كهربائية (LED, لوحات توزيع, كابلات, مولدات)",
            business_registration_number="CN-GZ-2025-4471",
            factory_address="No. 88, Baiyun Industrial Zone, Guangzhou, Guangdong, China",
            verification_status=VerificationStatus.VERIFIED,
            product_categories=["Lighting", "Electrical", "Cables", "Generators"],
        )
    )
    print("   └─ Created SupplierProfile (verified)")


async def ensure_client_profile(session, user: User) -> None:
    result = await session.execute(select(ClientProfile).where(ClientProfile.user_id == user.id))
    if result.scalar_one_or_none():
        return
    session.add(
        ClientProfile(
            id=uuid.uuid4(),
            user_id=user.id,
            company_name="شركة دار الإنشاء للمقاولات الكهربائية",
            preferred_port="Aqaba",
            contact_number="+962795551234",
        )
    )
    print("   └─ Created ClientProfile")


# ═══════════════════════════════════════════════════════════
# Step 2 — RFQs + Products
# ═══════════════════════════════════════════════════════════

RFQ_DEFS = [
    {
        "key": "A_open",
        "status": RFQStatus.OPEN,
        "client_request_arabic": (
            "نحتاج عرض سعر لـ 300 كشاف LED صناعي عالي الخليج (High Bay) بقدرة 150 واط "
            "لمصنع جديد في الزرقاء، التسليم عبر ميناء العقبة"
        ),
        "translated_query_chinese": "需要为扎尔卡新工厂采购300套150瓦LED高顶灯(High Bay)报价，通过亚喀巴港交货",
        "destination_port": "ميناء العقبة",
        "target_currency": "JOD",
        "product": {
            "name": "كشاف LED صناعي Highbay 150W",
            "quantity": 300,
            "specifications": "قدرة 150 واط، إضاءة بيضاء 6000K، مقاومة للغبار والرطوبة IP65، للاستخدام في المصانع وصالات الإنتاج",
            "target_price": 38.0,
        },
    },
    {
        "key": "B_processing",
        "status": RFQStatus.PROCESSING,
        "client_request_arabic": (
            "طلب توريد لوحات توزيع كهربائية رئيسية (Main Distribution Panels) لمشروع سكني، "
            "8 لوحات بمواصفات IP54"
        ),
        "translated_query_chinese": "需要为住宅项目供应8面主配电柜(MDB)，防护等级IP54",
        "destination_port": "ميناء العقبة",
        "target_currency": "JOD",
        "product": {
            "name": "لوحة توزيع كهربائي رئيسية MDB",
            "quantity": 8,
            "specifications": "IP54، سعة 400 أمبير، قواطع Schneider أو مكافئ معتمد",
            "target_price": 950.0,
        },
    },
    {
        "key": "C_quoted_sent",
        "status": RFQStatus.PROCESSING,  # will move to QUOTED via finalize_quotation
        "client_request_arabic": (
            "مطلوب 5000 متر كابل كهربائي أرضي مصفح NYY مقطع 4×16 مم² لمشروع طاقة شمسية"
        ),
        "translated_query_chinese": "太阳能项目需要5000米NYY铠装电缆，4×16平方毫米",
        "destination_port": "ميناء العقبة",
        "target_currency": "JOD",
        "product": {
            "name": "كابل كهربائي أرضي مصفح NYY 4×16mm²",
            "quantity": 5000,
            "specifications": "مصفح، مقاوم للرطوبة، مطابق لمواصفة IEC 60502",
            "target_price": 4.2,
        },
    },
    {
        "key": "D_quoted_accepted",
        "status": RFQStatus.PROCESSING,  # will move to QUOTED via finalize_quotation
        "client_request_arabic": (
            "طلب شراء 15 مولد كهرباء ديزل صناعي بقدرة 100 كيلو فولت أمبير لمشروع مبانٍ تجارية"
        ),
        "translated_query_chinese": "商业建筑项目需要采购15台100KVA工业柴油发电机",
        "destination_port": "ميناء العقبة",
        "target_currency": "JOD",
        "product": {
            "name": "مولد كهرباء ديزل صناعي 100KVA",
            "quantity": 15,
            "specifications": "محرك Cummins أو مكافئ، تشغيل صامت Silent Type، لوحة تحكم أوتوماتيكية ATS",
            "target_price": 5200.0,
        },
    },
    {
        "key": "E_no_match",
        "status": RFQStatus.OPEN,
        "client_request_arabic": (
            "نبحث عن مورد لقطع غيار طائرات ركاب (محامل تيتانيوم لمحركات نفاثة) بمواصفات طيران معتمدة"
        ),
        "translated_query_chinese": "寻找喷气发动机钛合金轴承供应商，需符合航空认证标准",
        "destination_port": "ميناء العقبة",
        "target_currency": "USD",
        "product": {
            "name": "محامل تيتانيوم لمحركات طائرات نفاثة",
            "quantity": 50,
            "specifications": "مطابقة لمواصفة AS9100، شهادة منشأ ومطابقة طيران مطلوبة",
            "target_price": 1200.0,
        },
    },
]


async def ensure_rfq(session, *, client: User, agent: User, defn: dict) -> tuple[RFQ, Product, bool]:
    """Returns (rfq, product, created)."""
    result = await session.execute(
        select(RFQ).where(
            RFQ.client_id == client.id,
            RFQ.agent_id == agent.id,
            RFQ.client_request_arabic == defn["client_request_arabic"],
        )
    )
    rfq = result.scalar_one_or_none()
    if rfq:
        product_result = await session.execute(select(Product).where(Product.rfq_id == rfq.id))
        product = product_result.scalars().first()
        print(f"⏭️  RFQ already exists [{defn['key']}]: {rfq.id}")
        return rfq, product, False

    rfq = RFQ(
        id=uuid.uuid4(),
        client_id=client.id,
        agent_id=agent.id,
        client_name="شركة دار الإنشاء للمقاولات الكهربائية",
        client_phone="+962795551234",
        client_request_arabic=defn["client_request_arabic"],
        translated_query_chinese=defn["translated_query_chinese"],
        destination_port=defn["destination_port"],
        target_currency=defn["target_currency"],
        status=defn["status"],
    )
    session.add(rfq)
    await session.flush()

    p = defn["product"]
    product = Product(
        id=uuid.uuid4(),
        rfq_id=rfq.id,
        name=p["name"],
        specifications=p["specifications"],
        quantity=p["quantity"],
        target_price=p["target_price"],
    )
    session.add(product)
    await session.flush()
    print(f"✅ Created RFQ [{defn['key']}] status={rfq.status.value}: {p['name']} x{p['quantity']}")
    return rfq, product, True


# ═══════════════════════════════════════════════════════════
# Step 3 — Quote pipeline (via real HTTP API)
# ═══════════════════════════════════════════════════════════

async def login(client: httpx.AsyncClient, email: str, password: str) -> str:
    resp = await client.post(f"{API_V1}/auth/login", json={"email": email, "password": password})
    resp.raise_for_status()
    return resp.json()["access_token"]


async def build_and_send_quote(
    http: httpx.AsyncClient,
    agent_token: str,
    client_token: str,
    rfq_id: str,
    product_id: str,
    product_name: str,
    quantity: int,
    unit_price_cny: float,
    weight_kg: float,
    destination_port: str,
    also_accept: bool,
) -> dict:
    """Runs the real pricing calc -> create quotation -> finalize (PDF) -> send.
    Optionally has the client accept it and progresses tracking. Returns the
    final quotation dict.
    """
    agent_headers = {"Authorization": f"Bearer {agent_token}"}
    client_headers = {"Authorization": f"Bearer {client_token}"}

    calc_resp = await http.post(
        f"{API_V1}/pricing/calculate",
        headers=agent_headers,
        json={
            "rfq_id": rfq_id,
            "target_currency": "JOD",
            "destination_port": destination_port,
            "products": [
                {
                    "product_id": product_id,
                    "name": product_name,
                    "quantity": quantity,
                    "unit_price_cny": unit_price_cny,
                    "weight_kg": weight_kg,
                    "has_license": False,
                }
            ],
        },
    )
    calc_resp.raise_for_status()
    calc = calc_resp.json()
    line = calc["line_items"][0]

    create_resp = await http.post(
        f"{API_V1}/quotes",
        headers=agent_headers,
        json={
            "rfq_id": rfq_id,
            "target_currency": calc["target_currency"],
            "exchange_rate_used": calc["exchange_rate_used"],
            "line_items": [
                {
                    "product_id": product_id,
                    "product_name": line["product_name"],
                    "quantity": line["quantity"],
                    "unit_price_cny": line["unit_price_cny"],
                    "unit_price_converted": line["unit_price_converted"],
                    "exchange_rate": line["exchange_rate"],
                    "freight_cost": line["freight_cost"],
                    "customs_duty": line["customs_duty"],
                    "commission": line["commission"],
                    "discount": line["discount"],
                    "total": line["total"],
                }
            ],
            "subtotal": calc["subtotal_before_vat"],
            "freight_total": line["freight_cost"],
            "customs_total": line["customs_duty"],
            "commission_total": line["commission"],
            "discount_total": calc["discount_total"],
            "vat_total": calc["vat"],
            "grand_total": calc["grand_total"],
            "payment_terms": "دفعة أولى 30% عند تأكيد الطلب، والباقي قبل الشحن (T/T)",
            "delivery_terms": "CIF ميناء العقبة",
            "validity_days": 30,
            "notes": "السعر يشمل الشحن البحري والتخليص الجمركي حتى ميناء العقبة.",
        },
    )
    create_resp.raise_for_status()
    quotation = create_resp.json()
    quotation_id = quotation["id"]

    finalize_resp = await http.post(f"{API_V1}/quotes/{quotation_id}/finalize", headers=agent_headers)
    finalize_resp.raise_for_status()

    send_resp = await http.put(
        f"{API_V1}/quotes/{quotation_id}/status",
        headers=agent_headers,
        params={"new_status": "sent"},
    )
    send_resp.raise_for_status()
    quotation = send_resp.json()

    if also_accept:
        accept_resp = await http.post(f"{API_V1}/quotes/{quotation_id}/accept", headers=client_headers)
        accept_resp.raise_for_status()
        quotation = accept_resp.json()

        for stage, notes in [
            ("production", "بدأ التصنيع في المصنع بقوانغتشو، المدة المتوقعة 12 يوماً"),
            ("inland_freight", "الشحنة في طريقها من المصنع إلى ميناء شنتشن للشحن"),
            ("sea_freight", "الشحنة على متن الباخرة، الوصول المتوقع لميناء العقبة خلال 12 يوماً"),
        ]:
            track_resp = await http.put(
                f"{API_V1}/quotes/{quotation_id}/tracking",
                headers=agent_headers,
                json={"status": stage, "notes": notes},
            )
            track_resp.raise_for_status()

    return quotation


# ═══════════════════════════════════════════════════════════
# Step 3b — Pending catalog products (for ProductReviewPage)
# ═══════════════════════════════════════════════════════════

PENDING_CATALOG_PRODUCTS = [
    {
        "product_name": "كشاف LED صناعي مقاوم للانفجار Highbay 200W",
        "model_number": "GZ-EX-200W",
        "unit_price_rmb": 145.0,
        "moq": 100,
        "weight_kg": 3.2,
        "dimensions": "35×35×20 cm",
        "material": "ألمنيوم مصبوب",
        "category": "Lighting",
    },
    {
        "product_name": "لوحة كهربائية فرعية مقاومة للماء IP65",
        "model_number": "SUB-IP65-63A",
        "unit_price_rmb": 210.0,
        "moq": 20,
        "weight_kg": 8.5,
        "dimensions": "50×40×20 cm",
        "material": "بولي كربونات مقوى",
        "category": "Electrical",
    },
]


async def ensure_pending_catalog_products(session, *, agent: User, rfq: RFQ) -> None:
    """Seeds a couple of AI-extracted, not-yet-reviewed catalog products so
    ProductReviewPage has something real to approve/reject during the demo
    instead of showing its (correct, but untestable) empty state.
    """
    existing = await session.execute(
        select(CatalogProduct).where(CatalogProduct.supplier_id == agent.id)
    )
    if existing.scalars().first():
        print("⏭️  Pending catalog products already exist for agent")
        return

    doc_result = await session.execute(
        select(Document).where(Document.uploaded_by_id == agent.id)
    )
    document = doc_result.scalars().first()
    if not document:
        document = Document(
            id=uuid.uuid4(),
            rfq_id=rfq.id,
            uploaded_by_id=agent.id,
            file_name="Guangzhou_Lighting_Catalog_2026.pdf",
            file_path=f"documents/{agent.id}/Guangzhou_Lighting_Catalog_2026.pdf",
            content_type="application/pdf",
            doc_type=DocumentType.PDF,
            status=DocumentStatus.EXTRACTED,
        )
        session.add(document)
        await session.flush()

    for p in PENDING_CATALOG_PRODUCTS:
        session.add(
            CatalogProduct(
                id=uuid.uuid4(),
                document_id=document.id,
                supplier_id=agent.id,
                review_status=ProductReviewStatus.PENDING,
                **p,
            )
        )
    print(f"✅ Created {len(PENDING_CATALOG_PRODUCTS)} pending catalog products awaiting review")


# ═══════════════════════════════════════════════════════════
# Step 4 — Chat room
# ═══════════════════════════════════════════════════════════

CHAT_MESSAGES = [
    ("client", "مرحباً، هل يمكن تأكيد أن السعر المرسل يشمل التخليص الجمركي حتى العقبة؟"),
    ("agent", "أهلاً بك، نعم السعر CIF ميناء العقبة ويشمل الشحن البحري والتخليص الجمركي بالكامل."),
    ("client", "ممتاز. هل الكمية 5000 متر قابلة للتقسيم على شحنتين؟"),
    ("agent", "يمكن تقسيمها، لكن يُفضّل شحنة واحدة لتفادي تكلفة شحن إضافية على الكمية الصغيرة."),
    ("client", "حسناً سنعتمد شحنة واحدة. ما هي مدة التصنيع المتوقعة بعد تأكيد الدفعة الأولى؟"),
    ("agent", "حوالي 10 إلى 12 يوم عمل بعد استلام الدفعة الأولى، ثم الشحن البحري يستغرق حوالي 12 يوماً إضافياً."),
    ("client", "تمام، سنقوم بتحويل الدفعة الأولى خلال يومين وسنؤكد لكم."),
    ("agent", "ممتاز، بانتظار التأكيد لبدء الإجراءات فوراً."),
]


async def ensure_chat_room(session, *, client: User, agent: User, rfq: RFQ) -> None:
    result = await session.execute(
        select(ChatRoom).where(ChatRoom.rfq_id == rfq.id, ChatRoom.client_id == client.id, ChatRoom.supplier_id == agent.id)
    )
    room = result.scalar_one_or_none()
    if room:
        print("⏭️  Chat room already exists for RFQ C")
        return

    room = ChatRoom(id=uuid.uuid4(), rfq_id=rfq.id, client_id=client.id, supplier_id=agent.id)
    session.add(room)
    await session.flush()

    base_time = datetime.now(timezone.utc) - timedelta(days=2)
    for i, (sender_role, content) in enumerate(CHAT_MESSAGES):
        sender = client if sender_role == "client" else agent
        session.add(
            ChatMessage(
                id=uuid.uuid4(),
                room_id=room.id,
                sender_id=sender.id,
                content=content,
                original_content=content,
                source_lang="ar",
                created_at=base_time + timedelta(minutes=i * 37),
            )
        )
    print(f"✅ Created chat room with {len(CHAT_MESSAGES)} messages")


# ═══════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════

async def seed():
    create_app()  # load all models

    async with async_session_factory() as session:
        agent = await ensure_user(
            session, email=AGENT_EMAIL, password=AGENT_PASSWORD,
            full_name="يوسف الزعبي", role=UserRole.AGENT, phone="+8613800001234",
        )
        await ensure_supplier_profile(session, agent)

        client = await ensure_user(
            session, email=CLIENT_EMAIL, password=CLIENT_PASSWORD,
            full_name="خالد أبو دار", role=UserRole.CLIENT, phone="+962795551234",
        )
        await ensure_client_profile(session, client)
        await session.commit()

        rfqs: dict[str, tuple[RFQ, Product, bool]] = {}
        for defn in RFQ_DEFS:
            rfqs[defn["key"]] = await ensure_rfq(session, client=client, agent=agent, defn=defn)
        await session.commit()

        rfq_c, product_c, created_c = rfqs["C_quoted_sent"]
        rfq_d, product_d, created_d = rfqs["D_quoted_accepted"]
        rfq_a, _product_a, _created_a = rfqs["A_open"]

        await ensure_pending_catalog_products(session, agent=agent, rfq=rfq_a)
        await session.commit()

    # ---- Quote pipeline via real HTTP API ----
    async with httpx.AsyncClient(timeout=60.0) as http:
        agent_token = await login(http, AGENT_EMAIL, AGENT_PASSWORD)
        client_token = await login(http, CLIENT_EMAIL, CLIENT_PASSWORD)
        agent_headers = {"Authorization": f"Bearer {agent_token}"}

        # Only run the quote pipeline if no quotation exists yet for these RFQs
        existing_c = await http.get(f"{API_V1}/quotes", headers=agent_headers, params={"rfq_id": str(rfq_c.id)})
        existing_c.raise_for_status()
        if existing_c.json().get("total", 0) == 0:
            print("\n▶ Building & sending quote for RFQ C (cables)...")
            await build_and_send_quote(
                http, agent_token, client_token,
                rfq_id=str(rfq_c.id), product_id=str(product_c.id),
                product_name=product_c.name, quantity=product_c.quantity,
                unit_price_cny=30.0, weight_kg=0.35,
                destination_port="Aqaba", also_accept=False,
            )
            print("✅ RFQ C quotation created, finalized (PDF generated), and sent.")
        else:
            print("⏭️  Quotation for RFQ C already exists")

        existing_d = await http.get(f"{API_V1}/quotes", headers=agent_headers, params={"rfq_id": str(rfq_d.id)})
        existing_d.raise_for_status()
        if existing_d.json().get("total", 0) == 0:
            print("\n▶ Building, sending & accepting quote for RFQ D (generators)...")
            await build_and_send_quote(
                http, agent_token, client_token,
                rfq_id=str(rfq_d.id), product_id=str(product_d.id),
                product_name=product_d.name, quantity=product_d.quantity,
                unit_price_cny=26000.0, weight_kg=950.0,
                destination_port="Aqaba", also_accept=True,
            )
            print("✅ RFQ D quotation created, sent, accepted, and tracking advanced to sea_freight.")
        else:
            print("⏭️  Quotation for RFQ D already exists")

    # ---- Chat room ----
    async with async_session_factory() as session:
        rfq_c_fresh = (await session.execute(select(RFQ).where(RFQ.id == rfq_c.id))).scalar_one()
        client_fresh = (await session.execute(select(User).where(User.id == client.id))).scalar_one()
        agent_fresh = (await session.execute(select(User).where(User.id == agent.id))).scalar_one()
        await ensure_chat_room(session, client=client_fresh, agent=agent_fresh, rfq=rfq_c_fresh)
        await session.commit()

    print("\n" + "=" * 60)
    print("🔑 DEMO AGENT LOGIN")
    print(f"   Email:    {AGENT_EMAIL}")
    print(f"   Password: {AGENT_PASSWORD}")
    print("=" * 60)
    print("🔑 DEMO CLIENT LOGIN (for cross-checking client-side views)")
    print(f"   Email:    {CLIENT_EMAIL}")
    print(f"   Password: {CLIENT_PASSWORD}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed())
