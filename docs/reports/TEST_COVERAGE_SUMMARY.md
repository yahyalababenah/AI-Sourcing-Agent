# AI-Sourcing Hub — Test Coverage Summary

Generated at the end of Phase 5 of the test-suite build-out described in
`Claude-Code-Testing-Prompt.md`. For full context on any bug, gap, or design
decision referenced below, see `TESTING_FINDINGS.md` — this file only
summarizes what exists and its current pass/fail status; it doesn't repeat
the reasoning behind each finding.

## How to read this document

- **Written** = test count as authored.
- **Status** = actually run in this sandbox and confirmed, unless noted
  otherwise. Backend integration/legacy suites and the entire E2E layer
  require real PostgreSQL/Redis/MinIO/Celery and a real browser
  (`docker-compose.test.yml` + `npx playwright install`), neither available
  in the sandbox this suite was built in — those are marked **verified for
  syntax only** (parses/compiles, never executed end-to-end here). See
  "Environment notes" in `TESTING_FINDINGS.md` for the exact reproduction
  steps on a machine with Docker.

---

## Backend (Python / pytest) — 435 tests across `tests/`

| Directory | Tests | Status | Notes |
|---|---|---|---|
| `tests/unit/` | 179 (with `tests/security/`, see below) | ✅ Run, passing | Pure logic: currency conversion, JWT/blacklist, matcher category-extraction helpers, OCR JSON repair, pricing engine, token blacklist. SQLite-compatible, no external services. |
| `tests/integration/` | part of 244 unit+integration+security total | ⚠️ Verified for syntax; full run needs real PostgreSQL (JSONB, full-text search, native ENUM) | Covers exclusive-window expiry (real Celery Beat task), documents pipeline, PDF generation, SSE notifications/chat, review-status gate, RFQ↔CatalogProduct FK gap, migration up/down. |
| `tests/security/` | included in the 244 above | ✅ Run, passing (118/118 in isolation) | RBAC boundary matrix (58 tests), SQLi injection safety, CSP/security headers, MinIO signed-URL expiry, and the new `TestRegistrationRoleEscalation` (F3 regression guard). |
| `tests/test_auth/`, `tests/test_documents/`, `tests/test_intake/`, `tests/test_output/`, `tests/test_pricing/` | 191 (435 total − 244 unit/integration/security) | ⚠️ Pre-existing legacy API suites; run against real Postgres in CI's `integration-security` job | Pre-existing failures unrelated to this effort are documented in `TESTING_FINDINGS.md`'s Environment notes (weak test passwords, fake-PNG upload validation, cross-file test-isolation noise) — confirmed via before/after diffs, not new regressions. |

**Coverage (measured in this sandbox, unit+security subset only — the
full-suite number requires real Postgres and can only be measured in CI or a
Docker-enabled environment):**

| Module | Coverage | Note |
|---|---|---|
| `app/modules/pricing/engine.py` | 88% | Target (≥80%) met from unit tests alone. |
| `app/modules/auth/service.py` | 88% | Target met from unit tests alone. |
| `app/modules/auth/dependencies.py` | 84% | Target met from unit tests alone. |
| `app/modules/intake/matcher.py` | 48% | Pure category-extraction helpers only; `match_rfq_to_suppliers()`'s DB-querying logic requires real PostgreSQL (JSONB `?|` operator, TESTING_FINDINGS.md #2) — covered by `tests/integration/test_intake_router.py`, not measurable against SQLite. |
| Whole `app/` (unit+security only) | 55% | Router/service layers backed by Postgres-only queries aren't exercised without the integration/legacy suites, which need a real Postgres connection. |

---

## Frontend (Vitest + Testing Library) — 54 tests across 10 files

| File | Tests | Status |
|---|---|---|
| `PricingCalcPage.test.tsx` | — | ✅ Passing |
| `RFQCreatePage.test.tsx` | — | ✅ Passing (includes F1 regression: real `user.click()` proves Arabic validation messages actually display) |
| `useNotifications.test.ts` | — | ✅ Passing |
| `ChatRoomDetailPage.test.tsx` | — | ✅ Passing |
| `LoginPage.test.tsx` | — | ✅ Passing |
| `AdminLoginPage.test.tsx` | — | ✅ Passing |
| `ProductReviewPage.test.tsx` | — | ✅ Passing |
| `MarketplacePage.test.tsx` | — | ✅ Passing (includes F2 regression: real `toast.success` confirmation after RFQ submission) |
| `SettingsPage.test.tsx` | — | ✅ Passing (asserts the stub state directly, per finding #4) |
| `RegisterPage.test.tsx` | 4 | ✅ Passing (F4 regression: both roles register successfully with correct payload; missing-field validation shows the real Arabic message via actual `user.click()`) |

All 10 files / 54 tests pass together via `npx vitest run --no-file-parallelism`
(plain `npm test`/`vitest run` hits a resource-specific timeout in this
sandbox only — see Environment notes in `TESTING_FINDINGS.md`; not expected
on a normal dev machine or CI runner).

---

## E2E (Playwright) — 29 tests across 16 `.spec.ts` files, + 2 standalone synthetic scripts

All ⚠️ **verified for syntax only** (`npx tsc --noEmit` clean, all 16 files
discovered via `npx playwright test --list`) — no Docker in this sandbox, so
none were actually executed end to end.

### Phase 4 — core E2E (7 files, 15 tests)
| File | Covers |
|---|---|
| `e2e_full_customer_journey.spec.ts` | Catalog upload → OCR → review → marketplace → RFQ → match → live SSE notification → async PDF → accept → tracking. |
| `e2e_exclusive_to_public_transition.spec.ts` | Client RFQ, exclusive window expiry via the real Celery Beat task, visibility in an agent's public-pool tab. |
| `e2e_live_chat_two_tabs.spec.ts` | Two-browser-context live chat delivery via the fetch-based SSE stream. |
| `e2e_auth_full_cycle.spec.ts` | Client/agent/admin login → logout → real session invalidation (old token rejected). |
| `e2e_quote_pdf_download.spec.ts` | Pricing calculator → quote → real WeasyPrint PDF, content-verified. |
| `e2e_register_full_cycle.spec.ts` | Real self-registration UI for both roles (F4 regression, real browser). |
| `contract/pact_frontend_backend.spec.ts` | OpenAPI-schema-driven response validation (6 tests). |

### Phase 5 — lifecycle, accessibility, responsive, edge cases (9 files, 14 tests)
| File | Covers |
|---|---|
| `lifecycle/lifecycle_customer.spec.ts` | Real self-registration → RFQ → receive quote → accept → track. Supplier-rating step omitted — feature doesn't exist anywhere in the codebase (confirmed, brief marks it optional). |
| `lifecycle/lifecycle_supplier.spec.ts` | Register (still-`pending`, no verification gate exists — #5j) → upload → review → marketplace → exclusive match → **real (broken)** claim-match behavior (#0: endpoint crashes, request silently fails) → forced deadline expiry → match correctly shows "expired," claim buttons gone. |
| `lifecycle/lifecycle_rep.spec.ts` | Receive RFQ → review → add a shipping-cost override in QuoteBuilderPage (no separate "add shipping" step exists — folded into the quote builder) → send quote → follow status through to client acceptance. |
| `lifecycle/lifecycle_admin.spec.ts` | Admin-portal login → monitor system health → verify a pending supplier → manage users and review AI-cost stats via the real API (no frontend page exists for either — #5h/#5i, confirmed and documented, not silently worked around). |
| `a11y_scan.spec.ts` | axe-core WCAG 2 A/AA scan across 10 pages (public + authenticated client + authenticated agent), plus an explicit `dir="rtl"`/`lang="ar"` document-root check on every page. |
| `responsive_admin_dashboard.spec.ts` | Mobile (390×664) and tablet (768×1024) viewports — confirms the desktop sidebar is hidden below the `lg` breakpoint, the mobile tab bar is usable, and there's no horizontal overflow. |
| `chat_slow_network.spec.ts` | Slow-3G throttling (via a real CDP `Network.emulateNetworkConditions` session) plus a simulated full connection drop — confirms the chat's 3-second reconnect-on-drop logic actually recovers, no uncaught errors. |
| `ui_no_match_found.spec.ts` | Client UI when a match genuinely finds zero suppliers — confirms the real (silent) behavior: no success banner exists for this case (#5g, newly documented). |
| `ui_settings_stub_warning.spec.ts` | Settings page renders an honest "coming soon" placeholder — not a blank screen or console error. |

### Standalone synthetic scripts (not part of the Playwright test run by design)
| File | Purpose |
|---|---|
| `synthetic/synthetic_health_check.ts` | Cron-schedulable `/health` + `/metrics` check against a real deployment. |
| `synthetic/synthetic_sse_uptime.ts` | Long-lived SSE connection monitor — explicitly treats a rolling-restart disconnect as an expected, documented failure (finding #3: SSE is in-memory/single-process), not a false alarm. |

---

## Deferred (documented, not built this pass)

| Item | Reason |
|---|---|
| Load tests (Locust) | Deferred per user decision in Phase 1 — revisit once the core suite is stable in a real environment. |
| Visual regression (Storybook + Chromatic/Percy) | Deferred per user decision in Phase 1. |

---

## CI (`.github/workflows/ci.yml`)

| Job | Trigger | Runs |
|---|---|---|
| `backend-unit` | every push | `tests/unit/` (SQLite, no services) |
| `frontend-unit` | every push | Vitest full suite |
| `integration-security` | every pull request | `tests/integration/`, `tests/security/`, and the legacy `test_auth`/`test_documents`/`test_intake`/`test_output`/`test_pricing` suites, against a real PostgreSQL 16 service container |
| `e2e` | nightly (02:00 UTC cron) or manual `workflow_dispatch` (e.g. before a production deploy) | Full Playwright suite against `docker-compose.test.yml`, with a report artifact uploaded on every run |

YAML validated (`yaml.safe_load`); the workflow itself has not been run on a
real GitHub Actions runner from within this sandbox.
