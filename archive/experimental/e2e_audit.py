#!/usr/bin/env python3
"""
AI-Sourcing Hub — End-to-End Integration Audit v2
Senior QA Automation: Hardened API Integration Test Orchestration
Uses only Python stdlib (urllib) — no external dependencies.
"""
import asyncio, json, sys, uuid, os
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import urlencode

# ── Credentials ──────────────────────────────────────────────
# Centralised in tests/test_config.py; fallback values keep this
# script runnable as a standalone (stdlib-only) file.
try:
    from tests.test_config import (
        E2E_TEST_PASSWORD,
        DEMO_ADMIN_EMAIL,
        DEMO_ADMIN_PASSWORD,
    )
except ImportError:
    E2E_TEST_PASSWORD = "TestPass123!"
    DEMO_ADMIN_EMAIL = "admin@example.com"
    DEMO_ADMIN_PASSWORD = "password123"

BASE = "http://localhost:8000/api/v1"
PASS = E2E_TEST_PASSWORD
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

results: list[dict] = []
errors: list[str] = []
tokens: dict[str, str] = {}
created_ids: dict[str, str] = {}
_ts = lambda: datetime.now(timezone.utc).isoformat()

def log_test(phase: str, test: str, status: str, detail: str = ""):
    icon = {"PASS": "✅", "FAIL": "❌", "WARN": "⚠️", "INFO": "ℹ️"}.get(status, "➡️")
    print(f"  {icon} [{phase}] {test}: {status}{' — ' + detail if detail else ''}")
    results.append({"phase": phase, "test": test, "status": status, "detail": detail, "timestamp": _ts()})

def log_error(phase: str, test: str, err: str):
    errors.append(f"[{phase}] {test}: {err}")
    log_test(phase, test, "FAIL", err)

# ── HTTP helpers ──
def _request(method: str, path: str, data: dict | None = None,
             headers: dict | None = None) -> tuple[int, dict]:
    url = f"{BASE}{path}"
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = Request(url, data=body, headers=req_headers, method=method)
    try:
        with urlopen(req, timeout=30) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            return e.code, json.loads(content)
        except (json.JSONDecodeError, ValueError):
            return e.code, {"error": content}
    except Exception as e:
        return 0, {"error": str(e)}

async def _req(method: str, path: str, data: dict | None = None,
               headers: dict | None = None) -> tuple[int, dict]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _request, method, path, data, headers)


class E2EAuditor:
    # ──────────────────────────────────────────
    # 1.1 Auth & Profiles Pipeline
    # ──────────────────────────────────────────
    async def test_register_client(self):
        print(f"\n{BOLD}{CYAN}═══ 1.1 Auth & Profiles Pipeline ═══{RESET}")
        uid = uuid.uuid4().hex[:8]
        payload = {
            "email": f"e2e_client_{uid}@test.com",
            "password": PASS,
            "full_name": f"E2E Client {uid}",
            "role": "client",
            "phone": "+96270000001",
            "company_name": "E2E Audit Corp",
        }
        status, data = await _req("POST", "/auth/register", data=payload)
        if status == 201:
            created_ids["client_email"] = payload["email"]
            log_test("1.1", "POST /auth/register (client)", "PASS",
                     f"id={str(data.get('id',''))[:8]} role={data.get('role')}")
            profile = data.get("profile") or {}
            cn = profile.get("company_name") or data.get("company_name")
            if cn == "E2E Audit Corp":
                log_test("1.1", "profile eager-loaded", "PASS", f"company_name={cn}")
            else:
                log_test("1.1", "profile eager-loaded", "WARN", f"Missing: {profile}")
        else:
            log_error("1.1", "POST /auth/register (client)", f"HTTP {status}: {data}")

    async def test_register_supplier(self):
        uid = uuid.uuid4().hex[:8]
        payload = {
            "email": f"e2e_supplier_{uid}@test.com",
            "password": PASS,
            "full_name": f"E2E Supplier {uid}",
            "role": "agent",
            "phone": "+96270000002",
            "factory_name": "E2E Factory Ltd",
            "location_in_china": "Shenzhen, Guangdong",
            "specialty": "Electronics",
        }
        status, data = await _req("POST", "/auth/register", data=payload)
        if status == 201:
            created_ids["supplier_email"] = payload["email"]
            log_test("1.1", "POST /auth/register (supplier)", "PASS",
                     f"id={str(data.get('id',''))[:8]} role={data.get('role')}")
            profile = data.get("profile") or {}
            fn = profile.get("factory_name") or data.get("factory_name")
            if fn == "E2E Factory Ltd":
                log_test("1.1", "profile eager-loaded", "PASS", f"factory_name={fn}")
            else:
                log_test("1.1", "profile eager-loaded", "WARN", f"Missing: {profile}")
        else:
            log_error("1.1", "POST /auth/register (supplier)", f"HTTP {status}: {data}")

    async def test_login_and_me(self, email: str, label: str):
        status, data = await _req("POST", "/auth/login", data={"email": email, "password": PASS})
        if status != 200 or "access_token" not in data:
            log_error("1.1", f"POST /auth/login ({label})", f"HTTP {status}: no access_token")
            return
        token = data["access_token"]
        tokens[label] = token
        log_test("1.1", f"POST /auth/login ({label})", "PASS", "access_token obtained")

        status2, me = await _req("GET", "/auth/me", headers={"Authorization": f"Bearer {token}"})
        if status2 == 200 and me.get("email") == email:
            profile = me.get("profile") or {}
            profile_ok = bool(profile and (profile.get("company_name") or profile.get("factory_name")))
            s = "PASS" if profile_ok else "WARN"
            log_test("1.1", f"GET /auth/me ({label})", s,
                     f"email={me['email']} profile_loaded={profile_ok}")
            # Verify NO MissingGreenlet — profile dict is populated, not a lazy proxy
            if profile_ok:
                log_test("1.1", f"MissingGreenlet check ({label})", "PASS",
                         "profile is a plain dict, not a lazy-loaded proxy")
        else:
            log_error("1.1", f"GET /auth/me ({label})", f"HTTP {status2}: mismatch")

    # ──────────────────────────────────────────
    # 1.2 RFQ Intake Pipeline
    # ──────────────────────────────────────────
    async def test_create_rfq(self):
        print(f"\n{BOLD}{CYAN}═══ 1.2 RFQ Intake Pipeline ═══{RESET}")
        ct = tokens.get("client")
        if not ct:
            log_error("1.2", "RFQ pipeline", "No client token")
            return
        payload = {
            "title": "E2E Audit RFQ — Electronics Components",
            "description": "Need 5000 units of microcontroller boards",
            "target_price": 15.50,
            "currency": "USD",
            "incoterm": "FOB",
            "port_of_loading": "Shenzhen",
            "target_country": "Jordan",
        }
        status, data = await _req("POST", "/intake/rfqs", data=payload,
                                  headers={"Authorization": f"Bearer {ct}"})
        if status == 201 and data.get("id"):
            created_ids["rfq_id"] = data["id"]
            log_test("1.2", "POST /intake/rfqs", "PASS",
                     f"id={data['id'][:8]} status={data.get('status')}")
            if data.get("status") == "open":
                log_test("1.2", "RFQ status=open", "PASS", "")
            else:
                log_error("1.2", "RFQ status=open", f"Got {data.get('status')}")
            if data.get("client_id"):
                log_test("1.2", "RFQ client scoping", "PASS", f"client_id={data['client_id'][:8]}")
            else:
                log_error("1.2", "RFQ client scoping", "client_id missing")
        else:
            log_error("1.2", "POST /intake/rfqs", f"HTTP {status}: {data}")

    async def test_list_rfqs_scoped(self):
        ct = tokens.get("client")
        if not ct:
            return
        status, data = await _req("GET", "/intake/rfqs",
                                  headers={"Authorization": f"Bearer {ct}"})
        if status == 200:
            items = data.get("items", [])
            found = any(item["id"] == created_ids.get("rfq_id") for item in items)
            log_test("1.2", "GET /intake/rfqs (client sees own)", "PASS" if found else "WARN",
                     f"total={data.get('total')} found_own={found}")
        else:
            log_error("1.2", "GET /intake/rfqs", f"HTTP {status}: {data}")

    # ──────────────────────────────────────────
    # 1.2b Add products to RFQ (agent-only, required for pricing & quotation FK)
    # ──────────────────────────────────────────
    async def test_add_products_to_rfq(self):
        st = tokens.get("supplier")
        if not st or "rfq_id" not in created_ids:
            log_error("1.2", "Add products", "Missing supplier token or RFQ ID")
            return
        rfq_id = created_ids["rfq_id"]
        sh = {"Authorization": f"Bearer {st}"}

        products_data = [
            ("Microcontroller Board v2", 5000, "ATmega328P, 32KB Flash, 16MHz"),
            ("Power Supply Unit", 5000, "5V 2A DC Power Supply"),
        ]
        pids = []
        for name, qty, specs in products_data:
            qs = urlencode({"name": name, "quantity": qty, "specifications": specs})
            s, d = await _req("POST", f"/intake/rfqs/{rfq_id}/products?{qs}",
                              headers=sh)
            if s == 201 and d.get("id"):
                pids.append(d["id"])
                log_test("1.2", f"Add product '{name}'", "PASS", f"id={d['id'][:8]}")
            else:
                log_error("1.2", f"Add product '{name}'", f"HTTP {s}: {d}")
        if len(pids) == 2:
            created_ids["product_ids"] = pids
            # Also fetch via GET to verify persistence
            s, d = await _req("GET", f"/intake/rfqs/{rfq_id}/products", headers=sh)
            if s == 200 and len(d) == 2:
                log_test("1.2", "GET /rfqs/{id}/products (verify)", "PASS", f"count={len(d)}")
            else:
                log_test("1.2", "GET /rfqs/{id}/products (verify)", "WARN", f"HTTP {s}: count={len(d) if isinstance(d,list) else 0}")

    # ──────────────────────────────────────────
    # 1.3 Document Processing Pipeline
    # ──────────────────────────────────────────
    async def test_document_upload_and_status(self):
        print(f"\n{BOLD}{CYAN}═══ 1.3 Document Processing Pipeline ═══{RESET}")
        st = tokens.get("supplier") or tokens.get("admin")
        if not st or "rfq_id" not in created_ids:
            log_error("1.3", "Document pipeline", "Missing supplier/admin token or RFQ ID")
            return
        rfq_id = created_ids["rfq_id"]

        # Upload as supplier (clients cannot upload — correct by design)
        doc_id = await self._upload_doc_curl(rfq_id, st)
        if not doc_id:
            return
        created_ids["doc_id"] = doc_id

        # Check status
        status, data = await _req("GET", f"/documents/{doc_id}/status",
                                  headers={"Authorization": f"Bearer {st}"})
        if status == 200:
            log_test("1.3", f"GET /documents/{doc_id}/status", "PASS",
                     f"status={data.get('status')}")
        else:
            log_test("1.3", "GET /documents/{id}/status", "WARN", f"HTTP {status}: {data}")

        # Check initial items (should be empty before processing)
        status, data = await _req("GET", f"/documents/{doc_id}/items",
                                  headers={"Authorization": f"Bearer {st}"})
        if status == 200:
            count = len(data) if isinstance(data, list) else data.get("total", 0)
            log_test("1.3", "GET /documents/{id}/items (initial)", "PASS",
                     f"items_count={count}")
        else:
            log_test("1.3", "GET /documents/{id}/items (initial)", "WARN", f"HTTP {status}")

    async def _upload_doc_curl(self, rfq_id: str, token: str) -> str | None:
        import subprocess
        tmpfile = "/tmp/e2e_test_doc.txt"
        with open(tmpfile, "w") as f:
            f.write("INVOICE\nItem: Microcontroller Board\nQty: 5000\nUnit Price: 12.00 USD")
        cmd = [
            "curl", "-s", "-X", "POST",
            f"{BASE}/documents/upload",
            "-H", f"Authorization: Bearer {token}",
            "-F", f"rfq_id={rfq_id}",
            "-F", f"file=@{tmpfile};type=text/plain",
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        stdout, _ = await proc.communicate()
        try:
            data = json.loads(stdout.decode())
        except json.JSONDecodeError:
            log_error("1.3", "POST /documents/upload", f"Invalid JSON: {stdout.decode()[:200]}")
            return None
        if data.get("id"):
            log_test("1.3", "POST /documents/upload", "PASS",
                     f"doc_id={data['id'][:8]} type={data.get('document_type')}")
            return data["id"]
        log_error("1.3", "POST /documents/upload", f"Response: {data}")
        return None

    # ──────────────────────────────────────────
    # 1.4 Pricing & Quotation Engine
    # ──────────────────────────────────────────
    async def test_pricing_rules_crud(self):
        print(f"\n{BOLD}{CYAN}═══ 1.4 Pricing & Quotation Engine ═══{RESET}")
        at = tokens.get("admin")
        if not at:
            log_error("1.4", "Pricing rules", "No admin token")
            return
        ah = {"Authorization": f"Bearer {at}"}

        rules = [
            {"name": "E2E Commission 5%", "category": "commission",
             "rule_type": "percentage", "value": 5.0, "priority": 10, "active": True},
            {"name": "E2E MOQ 2% Discount", "category": "discount",
             "rule_type": "percentage", "value": 2.0, "priority": 5, "active": True,
             "min_quantity": 1000},
            {"name": "E2E Freight $200", "category": "freight",
             "rule_type": "fixed", "value": 200.0, "priority": 1, "active": True},
        ]
        rids = []
        for rule in rules:
            s, d = await _req("POST", "/pricing/rules", data=rule, headers=ah)
            if s == 201 and d.get("id"):
                rids.append(d["id"])
                log_test("1.4", f"POST /pricing/rules ({rule['name']})", "PASS",
                         f"id={d['id'][:8]} cat={rule['category']}")
            else:
                log_error("1.4", f"POST /pricing/rules", f"HTTP {s}: {d}")
        created_ids["pricing_rule_ids"] = rids

        s, d = await _req("GET", "/pricing/rules", headers=ah)
        if s == 200:
            total = d.get("total", len(d.get("items", [])))
            log_test("1.4", "GET /pricing/rules", "PASS" if total >= len(rids) else "WARN",
                     f"total={total}")
        else:
            log_error("1.4", "GET /pricing/rules", f"HTTP {s}: {d}")

    async def test_calculate_pricing(self):
        st = tokens.get("supplier") or tokens.get("admin")
        if not st or "rfq_id" not in created_ids or "product_ids" not in created_ids:
            log_error("1.4", "Calculate pricing", "Missing supplier token, RFQ ID, or product IDs")
            return
        pids = created_ids["product_ids"]
        payload = {
            "rfq_id": created_ids["rfq_id"],
            "target_currency": "USD",
            "destination_port": "Aqaba",
            "products": [
                {"product_id": pids[0], "name": "Microcontroller Board v2",
                 "quantity": 5000, "unit_price_cny": 105.0},
                {"product_id": pids[1], "name": "Power Supply Unit",
                 "quantity": 5000, "unit_price_cny": 23.2},
            ],
        }
        s, d = await _req("POST", "/pricing/calculate", data=payload,
                          headers={"Authorization": f"Bearer {st}"})
        if s == 200:
            items = d.get("line_items", [])
            log_test("1.4", "POST /pricing/calculate (supplier)", "PASS",
                     f"grand_total={d.get('grand_total')} items={len(items)}")
            created_ids["pricing_result"] = d
        else:
            log_error("1.4", "POST /pricing/calculate (supplier)", f"HTTP {s}: {d}")

    async def test_create_quotation(self):
        st = tokens.get("supplier")
        if not st or "rfq_id" not in created_ids or "product_ids" not in created_ids:
            log_error("1.4", "Create quotation", "Missing supplier token, RFQ ID, or product IDs")
            return
        pids = created_ids["product_ids"]

        # Build quotation with all required computed fields using REAL product IDs
        line_items = [
            {
                "product_id": pids[0],
                "product_name": "Microcontroller Board v2",
                "quantity": 5000,
                "unit_price_cny": 105.0,
                "unit_price_converted": 14.50,
                "exchange_rate": 7.24,
                "freight_cost": 0.50,
                "customs_duty": 0.75,
                "commission": 0.72,
                "subtotal": 72500.0,
                "discount": 1450.0,
                "total": 71050.0,
            },
            {
                "product_id": pids[1],
                "product_name": "Power Supply Unit",
                "quantity": 5000,
                "unit_price_cny": 23.2,
                "unit_price_converted": 3.20,
                "exchange_rate": 7.24,
                "freight_cost": 0.30,
                "customs_duty": 0.40,
                "commission": 0.16,
                "subtotal": 16000.0,
                "discount": 320.0,
                "total": 15680.0,
            },
        ]
        subtotal = sum(li["quantity"] * li["unit_price_converted"] for li in line_items)
        grand_total = sum(li["total"] for li in line_items)

        payload = {
            "rfq_id": created_ids["rfq_id"],
            "target_currency": "USD",
            "exchange_rate_used": 7.24,
            "line_items": line_items,
            "subtotal": subtotal,
            "freight_total": 4000.0,
            "customs_total": 5750.0,
            "commission_total": 4400.0,
            "discount_total": 1770.0,
            "vat_total": 0.0,
            "grand_total": grand_total,
            "payment_terms": "30 days net",
            "delivery_terms": "FOB Shenzhen",
            "validity_days": 30,
            "notes": "E2E Audit Quotation",
        }
        s, d = await _req("POST", "/quotes", data=payload,
                          headers={"Authorization": f"Bearer {st}"})
        if s == 201 and d.get("id"):
            created_ids["quotation_id"] = d["id"]
            log_test("1.4", "POST /quotes", "PASS",
                     f"id={d['id'][:8]} status={d.get('status')} line_items={len(d.get('line_items',[]))}")
            if d.get("status") == "draft":
                log_test("1.4", "Quotation status=draft", "PASS", "")
            else:
                log_error("1.4", "Quotation status=draft", f"Got {d.get('status')}")
            if len(d.get("line_items", [])) == 2:
                log_test("1.4", "line_items serialized", "PASS", "2 items")
            else:
                log_error("1.4", "line_items serialized", f"Expected 2, got {len(d.get('line_items',[]))}")
        else:
            log_error("1.4", "POST /quotes", f"HTTP {s}: {d}")

    async def test_quotation_detail(self):
        st = tokens.get("supplier")
        if not st or "quotation_id" not in created_ids:
            return
        qid = created_ids["quotation_id"]
        s, d = await _req("GET", f"/quotes/{qid}",
                          headers={"Authorization": f"Bearer {st}"})
        if s == 200 and d.get("id") == qid:
            log_test("1.4", "GET /quotes/{id} (detail)", "PASS",
                     f"status={d.get('status')} line_items={len(d.get('line_items',[]))}")
        else:
            log_error("1.4", "GET /quotes/{id}", f"HTTP {s}: {d}")

    # ──────────────────────────────────────────
    # Admin Verification
    # ──────────────────────────────────────────
    async def test_admin_endpoints(self):
        print(f"\n{BOLD}{CYAN}═══ Admin Verification ═══{RESET}")
        at = tokens.get("admin")
        if not at:
            log_error("Admin", "Endpoints", "No admin token")
            return
        ah = {"Authorization": f"Bearer {at}"}

        s, d = await _req("GET", "/admin/stats", headers=ah)
        if s == 200:
            log_test("Admin", "GET /admin/stats", "PASS",
                     f"users={d.get('total_users')} rfqs={d.get('total_rfqs')} "
                     f"docs={d.get('total_documents')} quotes={d.get('total_quotations')} "
                     f"rules={d.get('total_pricing_rules')}")
        else:
            log_error("Admin", "GET /admin/stats", f"HTTP {s}: {d}")

        s, d = await _req("GET", "/admin/users", headers=ah)
        if s == 200:
            items = d.get("items", [])
            log_test("Admin", "GET /admin/users", "PASS",
                     f"total={d.get('total')} roles={set(u['role'] for u in items)}")
        else:
            log_error("Admin", "GET /admin/users", f"HTTP {s}: {d}")

    # ──────────────────────────────────────────
    # Error Handler Audit
    # ──────────────────────────────────────────
    async def test_error_handlers(self):
        print(f"\n{BOLD}{CYAN}═══ Error Handler Audit ═══{RESET}")

        s, d = await _req("GET", "/nonexistent-route")
        log_test("Errors", "GET 404", "PASS" if s == 404 else "WARN",
                 f"HTTP {s}" if s != 404 else f"code={d.get('error',{}).get('code')}")

        s, d = await _req("POST", "/auth/register", data={"email": "not-an-email"})
        log_test("Errors", "POST 422 validation", "PASS" if s == 422 else "WARN", f"HTTP {s}")

        s, d = await _req("GET", "/intake/rfqs")
        log_test("Errors", "GET 401 no auth", "PASS" if s == 401 else "WARN", f"HTTP {s}")

        ct = tokens.get("client")
        if ct:
            s, d = await _req("GET", "/admin/stats", headers={"Authorization": f"Bearer {ct}"})
            log_test("Errors", "GET 403 forbidden (client→admin)", "PASS" if s in (401, 403) else "FAIL",
                     f"HTTP {s}")

        # Client tries to access pricing calculate (agent-only)
        if ct:
            s, d = await _req("POST", "/pricing/calculate",
                              data={"products": [], "shipping": {}, "target_currency": "USD"},
                              headers={"Authorization": f"Bearer {ct}"})
            log_test("Errors", "POST 403 client→pricing/calculate", "PASS" if s in (401, 403) else "FAIL",
                     f"HTTP {s}")

    # ──────────────────────────────────────────
    # Orchestrator
    # ──────────────────────────────────────────
    async def run_all(self):
        print(f"{BOLD}{CYAN}{'='*60}{RESET}")
        print(f"{BOLD}{CYAN}   AI-Sourcing Hub — E2E Integration Audit v3{RESET}")
        print(f"{BOLD}{CYAN}   Started: {_ts()}{RESET}")
        print(f"{BOLD}{CYAN}{'='*60}{RESET}")

        # Bootstrap
        print(f"\n{BOLD}{CYAN}═══ Bootstrap: Admin Login ═══{RESET}")
        s, d = await _req("POST", "/auth/login",
                          data={"email": DEMO_ADMIN_EMAIL, "password": DEMO_ADMIN_PASSWORD})
        if s == 200:
            tokens["admin"] = d["access_token"]
            log_test("Bootstrap", "Admin login", "PASS", "admin@example.com")
        else:
            log_error("Bootstrap", "Admin login", f"HTTP {s}: {d}")

        await self.test_register_client()
        await self.test_register_supplier()
        if "client_email" in created_ids:
            await self.test_login_and_me(created_ids["client_email"], "client")
        if "supplier_email" in created_ids:
            await self.test_login_and_me(created_ids["supplier_email"], "supplier")
        await self.test_create_rfq()
        await self.test_list_rfqs_scoped()
        # Add products to RFQ (agent-only) — required for pricing & quotation FK constraints
        await self.test_add_products_to_rfq()
        await self.test_document_upload_and_status()
        await self.test_pricing_rules_crud()
        await self.test_calculate_pricing()
        await self.test_create_quotation()
        await self.test_quotation_detail()
        await self.test_admin_endpoints()
        await self.test_error_handlers()
        await self.print_summary()
        return 1 if any(r["status"] == "FAIL" for r in results) else 0

    async def print_summary(self):
        total = len(results)
        passed = sum(1 for r in results if r["status"] == "PASS")
        failed = sum(1 for r in results if r["status"] == "FAIL")
        warned = sum(1 for r in results if r["status"] == "WARN")

        print(f"\n{BOLD}{'='*60}{RESET}")
        print(f"{BOLD}   AUDIT SUMMARY{RESET}")
        print(f"{BOLD}{'='*60}{RESET}")
        print(f"  Total Tests : {total}")
        print(f"  {GREEN}Passed      : {passed}{RESET}")
        print(f"  {RED}Failed      : {failed}{RESET}")
        print(f"  {YELLOW}Warnings    : {warned}{RESET}\n")

        if errors:
            print(f"{BOLD}{RED}Error Details:{RESET}")
            for e in errors:
                print(f"  {RED}✗{RESET} {e}")
            print()

        phases = {}
        for r in results:
            phases.setdefault(r["phase"], {"t": 0, "p": 0, "f": 0, "w": 0})
            phases[r["phase"]]["t"] += 1
            if r["status"] == "PASS": phases[r["phase"]]["p"] += 1
            elif r["status"] == "FAIL": phases[r["phase"]]["f"] += 1
            else: phases[r["phase"]]["w"] += 1

        print(f"{BOLD}Per-Phase Breakdown:{RESET}")
        for phase, c in sorted(phases.items()):
            print(f"  [{phase}] {c['t']} tests — "
                  f"{GREEN}{c['p']} pass{RESET}, {RED}{c['f']} fail{RESET}, {YELLOW}{c['w']} warn{RESET}")

        report = {
            "audit_timestamp": _ts(),
            "summary": {"total": total, "passed": passed, "failed": failed, "warnings": warned},
            "results": results, "errors": errors,
        }
        with open("/tmp/e2e_audit_report.json", "w") as f:
            json.dump(report, f, indent=2, default=str)
        print(f"\n📄 Report saved to /tmp/e2e_audit_report.json")

async def main():
    auditor = E2EAuditor()
    try:
        exit_code = await auditor.run_all()
    finally:
        pass
    sys.exit(exit_code)

if __name__ == "__main__":
    asyncio.run(main())
