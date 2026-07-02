# Testing Findings

Gaps and deviations discovered while building the test suite (Phase 0 exploration
+ Phase 1 infrastructure), documented per the testing brief's own rule: surface
gaps here rather than silently "fixing" or hiding them.

## Design gaps in the product code

### 0c. `search_catalog_fallback()` — the promised ILIKE fallback is dead code
Discovered while writing `test_review_status_gate.py`. `search_catalog()`
(catalog/service.py:208-336) — the function `GET /api/v1/catalog/products`
actually calls — builds a PostgreSQL-only full-text query
(`CatalogProduct.search_vector.op("@@")(func.plainto_tsquery(...))`)
whenever `q` is provided, with **no try/except and no row-count check**
around it. Its own docstring says "Falls back to ILIKE search when a
full-text query doesn't match" and a separate function,
`search_catalog_fallback()` (service.py:344+), implements exactly that ILIKE
logic — but grepping the whole module confirms `search_catalog_fallback` is
**never called from anywhere**. It's dead code. Consequences:
- **On SQLite** (this test suite): any search with `q` set raises
  `OperationalError: unrecognized token: "@"` immediately — not a graceful
  empty-result fallback, a hard crash.
- **On real PostgreSQL** (production): if a full-text query genuinely
  matches zero rows (plausible for mixed Chinese/Arabic tokenization,
  exactly the scenario the docstring calls out), the user gets zero results
  with **no ILIKE fallback ever firing** — contradicting the documented
  behavior and the Phase 0 exploration notes that assumed this fallback
  existed and worked.
`test_review_status_gate.py` avoids the `q` parameter entirely (uses
`category`, a plain equality filter that works on both dialects) to test the
review-status gate without tripping over this; it does not attempt to
verify the fallback promise since there's no working code path to verify.

### 0. CRITICAL — `POST /api/v1/intake/matches/{match_id}/claim` is 100% broken in production
`claim_match_endpoint` (`app/modules/intake/router.py:482-509`) is defined as:
```python
async def claim_match_endpoint(
    match_id: str,
    body: ClaimMatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_agent),
):
    ...
    match = await claim_match(db, match_id=match_id, supplier_id=str(current_user.id), ...)
```
`require_agent` is `require_role(UserRole.AGENT)` — a role **checker** whose
inner function returns `None` on success (it only raises on failure; every
other endpoint in the codebase correctly names this param `_current_user`
and gets the real user via a separate `Depends(get_current_user)` — 22 other
occurrences across `pricing`, `monitoring`, `output`, `documents`, and
`intake` routers all do this correctly). Here, `current_user` is bound
directly to `require_agent`'s return value, which is always `None`. The
handler body then does `current_user.id`, raising
`AttributeError: 'NoneType' object has no attribute 'id'` — **every single
call to this endpoint crashes**, unconditionally, in production as much as
in tests. This means suppliers can never accept or decline an exclusive RFQ
match through the API today.

**Reported to the user** with the one-line fix (split into
`_current_user: User = Depends(require_agent)` + a separate
`current_user: User = Depends(get_current_user)`) — **they chose to document
only, not fix, in this pass.** `tests/integration/test_intake_router.py`'s
`TestClaimMatch.test_currently_crashes_with_500_due_to_none_current_user`
asserts today's actual (broken) behavior as a live regression marker: it
must be rewritten (not left silently passing) once the real fix ships.

### 0b. Unhandled route exceptions raise raw into the test client instead of becoming JSON 500s
Noticed while writing the two tests above: when a route handler raises an
uncaught exception (both the bug above and the matcher UUID bug in finding
#2), the test client (`httpx.AsyncClient` + `ASGITransport`) re-raises the
exception into the test rather than yielding a `Response` with
`status_code == 500`, even though `app/shared/error_handlers.py` registers a
catch-all `app.add_exception_handler(Exception, generic_exception_handler)`.
This is a known Starlette `BaseHTTPMiddleware` interaction: this app stacks
three custom `BaseHTTPMiddleware` subclasses (`security_middleware`,
`metrics`, `rate_limiter`), and `ServerErrorMiddleware` sends the 500
response but then **re-raises** the exception afterward (by design, so ASGI
servers/loggers still see it) — `ASGITransport`'s default
`raise_app_exceptions=True` surfaces that re-raise in tests, while a real
ASGI server (uvicorn) would have already sent the client the 500 response
before that re-raise happens. Net effect: real clients of a crashing
endpoint do get a JSON 500, but asserting that behavior directly in this
test suite requires `pytest.raises(...)` around the request instead of
checking `resp.status_code`, which is what
`test_run_matching_endpoint_is_unusable_against_sqlite_for_any_input` and
`test_currently_crashes_with_500_due_to_none_current_user` do.

### 1. No `catalog_product_id` FK on `rfqs` or `products`
`RFQ` and `Product` (`app/modules/intake/models.py`) have no foreign key to
`CatalogProduct`. The only link is on `QuotationLineItem.catalog_product_id`
(migration `014_add_catalog_product_id_to_line_items.py`). Tracing "which
catalog product did this RFQ/Product resolve to" requires
`RFQ → Product → QuotationLineItem → CatalogProduct`, which is ambiguous
whenever a product could plausibly match more than one catalog listing.
`test_rfq_catalog_fk_gap.py` (Phase 2) documents this directly: it asserts
the columns/relationships genuinely don't exist, shows a name-based lookup
returning 2 equally-plausible `CatalogProduct` candidates for one RFQ's
product with no way to disambiguate, and confirms the FK only becomes
resolvable once a `QuotationLineItem` is actually built.

### 1b. `db_engine`'s bulk `create_all()` silently dropped every table after `catalog_products`
Found while writing `test_rfq_catalog_fk_gap.py`: creating a `QuotationLineItem`
row raised `OperationalError: no such table: quotation_line_items`, even
though the model and migration both exist. Root cause: `tests/conftest.py`'s
`db_engine` fixture ran `Base.metadata.create_all()` as a single bulk call
wrapped in one try/except. `CatalogProduct` registers a PostgreSQL-only
`after_create` DDL event (the `search_vector` trigger function) that raises
`OperationalError` on SQLite — and since `create_all()` creates tables
sequentially in one Python call, that exception aborted the *entire* batch,
silently skipping every table ordered after `catalog_products` in the
dependency graph (anything FK'ing to it — `quotation_line_items` included).
The pre-existing catch-and-log comment even says "these are non-essential,"
not realizing it was also swallowing real, needed tables.
**Fixed** in `tests/conftest.py`: `db_engine` now creates tables one at a time
via `Base.metadata.sorted_tables`, each in its own try/except, so only
`catalog_products`'s own trigger DDL is skipped and everything else — including
tables that depend on it — is created normally. Verified via full-suite
before/after: identical 20 failed / 47 errors baseline, +15 newly-passing
tests that depend on `quotation_line_items` existing. This is why it was safe
to fix directly (test infrastructure I already own from Phase 1, not
production code) rather than only documenting it.

### 2. `match_rfq_to_suppliers()` cannot run against SQLite at all
`app/modules/intake/matcher.py:258-263` queries
`SupplierProfile.product_categories.has_any(...)`, which compiles to
PostgreSQL's JSONB `?|` operator. SQLite has no equivalent
(`OperationalError: near "?": syntax error`). This query runs
**unconditionally** on every call — before catalog-match or no-match results
are even considered — so *every* scenario (direct catalog match, profile
overlap, no match found) fails against this suite's SQLite test DB, not just
the profile-overlap case specifically. `tests/unit/test_matcher_logic.py`
covers the two pure category-extraction helper functions in full, and
includes `test_end_to_end_matching_requires_postgres` which asserts the
current `OperationalError` explicitly (so it fails loudly, not silently, if
someone points this suite at a real Postgres later and forgets to update the
test). A related latent bug: `match_rfq_to_suppliers` compares
`RFQ.id == rfq_id` without `uuid.UUID(rfq_id)` (unlike its sibling
`service.get_rfq()`, which does convert) — harmless against real
Postgres+asyncpg (native UUID support means SQLAlchemy skips the bind
processor), but it's an inconsistency worth fixing for portability.

**Update from `test_intake_router.py`:** this UUID-conversion gap is worse
than "an inconsistency" — it means `POST /api/v1/intake/rfqs/{id}/match`
(`run_matching_endpoint` → `service.run_matching` → `match_rfq_to_suppliers`)
**never** converts the path-param string to a UUID anywhere in that call
chain, so the very first query (`select(RFQ).where(RFQ.id == rfq_id)`,
matcher.py:205-208) fails against SQLite for *any* RFQ, even one with zero
products/categories — this isn't reachable via HTTP at all in this test
environment, regardless of whether the profile-JSONB path would also be hit.
`test_run_matching_endpoint_is_unusable_against_sqlite_for_any_input` asserts
this explicitly.
Exercising the full matching pipeline requires a real PostgreSQL test
database — `docker-compose.test.yml` or CI's Postgres service container, not
the default SQLite fixture.

### 3. SSE is entirely in-memory, single-process
`app/shared/notifications.py` (`_user_subscribers`) and
`app/modules/chat/service.py` (`_room_subscribers`) use plain `asyncio.Queue`
dictionaries — no Redis pub/sub, no message broker. This works correctly
single-process/single-worker but:
- A rolling restart or multi-worker/multi-pod deployment silently drops
  connected SSE clients with no cross-process fan-out.
- `synthetic_sse_uptime.ts` (Phase 4), which the brief specifies should verify
  an SSE connection survives a rolling restart, **will fail by design** against
  the current architecture. This is a real product gap, not a test bug.

### 3b. `tests/conftest.py`'s TEST_ENV_OVERRIDES are silently never applied — and can't be, as-is
Discovered while writing `test_exclusive_window_expiry.py`. Two compounding
issues, found together:

**a) Wrong import order.** `conftest.py` does
`from app.main import create_app` (which imports `app.config`, constructing
the `Settings()` singleton from whatever `.env`/real env vars are present)
*before* the `for key, val in TEST_ENV_OVERRIDES.items(): os.environ[key] =
val` loop runs — even though the adjacent comment says "Force test settings
**before** importing app modules." Since `Settings` is a module-level singleton
built once at first import, setting env vars afterwards is a no-op: every
test in this suite has always run against the real `.env`'s `DATABASE_URL`
(or its absence) for anything that reads `settings.db_url` directly, not the
intended SQLite test override. `tests/conftest.py`'s own `db_engine` fixture
is unaffected only because it hardcodes its own
`create_async_engine("sqlite+aiosqlite://", ...)`, bypassing `settings.db_url`
entirely — but anything that reads `settings.db_url` directly (notably
`app.shared.database.create_sync_session_factory()`, used by the Celery
`expire_stale_matches_task` and other Celery tasks) gets a real
`postgresql+asyncpg://app_user:...@postgres:5432/aisourcing`-shaped URL
(rebuilt as sync `postgresql://`) and fails with
`could not translate host name "postgres"` the moment it's actually invoked
in a test — this is why the Celery task *wrapper* (as opposed to the plain
async functions in `matcher.py` it calls) can't be tested here at all; see
finding 3c.

**b) Even if the import order is fixed, the override values themselves don't
pass validation.** `tests/test_config.py`'s `TEST_ENV_OVERRIDES` sets
`ENVIRONMENT="testing"` (app/config.py's `Settings.ENVIRONMENT` only accepts
`development|staging|production`) and `DB_PASSWORD`/`JWT_SECRET` values
containing words `Settings`'s own placeholder-word validator rejects. I
verified this directly: reordering the import fixes (a) but then `Settings()`
raises 3 `ValidationError`s at collection time, which would break the entire
suite immediately. **I reverted the import-order change** rather than ship a
half-fix — properly resolving this needs `tests/test_config.py`'s override
values rewritten to satisfy `Settings`'s validators too, which is a broader
change than this test-writing pass should make silently. Confirmed via
before/after full-suite run: reverting restored the exact prior
20 failed / 47 errors baseline.

### 3c. Celery task *wrappers* (as opposed to the functions they call) can't run in this sandbox
Building on 3b: `app/modules/intake/tasks.py::expire_stale_matches_task` (and
any other Celery task using `create_sync_session_factory()`) opens its own
sync DB connection built from `settings.db_url`, which — per finding 3b —
always resolves to the real `postgresql://...@postgres:5432/...` URL in this
test environment, never the SQLite test DB. Invoking the task function
directly in a test raises `OperationalError: could not translate host name
"postgres"` immediately. `test_exclusive_window_expiry.py` therefore tests
the underlying async functions in `app/modules/intake/matcher.py`
(`expire_stale_matches()`, `open_rfq_to_public_pool()`) directly against the
SQLite test DB — which fully covers the actual business logic the Celery Beat
schedule triggers — rather than the Celery task wrapper itself. Testing the
wrapper end-to-end needs a real Postgres reachable at the configured test URL
(`docker-compose.test.yml` / CI's Postgres service), plus fixing 3a/3b first.

### 4. Settings page is a stub
`frontend/src/pages/settings/SettingsPage.tsx` has an explicit comment
("سيتم تنفيذ صفحة الإعدادات في مرحلة لاحقة") and zero data binding.
`SettingsPage.test.tsx` (Phase 3) asserts this stub state rather than testing
real functionality, so it breaks loudly in CI once the page is implemented.

### 5. Fail-open Redis in auth session invalidation
`app/modules/auth/dependencies.py` — if Redis is unreachable when checking
`session_invalidated:{user_id}`, access is granted rather than denied
(dependencies.py:111). This is a deliberate availability-over-security
tradeoff, now asserted explicitly by
`tests/unit/test_token_blacklist.py::test_fail_open_when_redis_unavailable`.

### 5b. `get_current_user`'s Redis check bypasses FastAPI dependency injection
`get_current_user` (dependencies.py:100) calls the module-level
`get_redis()` singleton directly instead of using the `get_redis_client`
FastAPI dependency that `tests/conftest.py`'s `app` fixture overrides. So any
HTTP-level test that only overrides `get_redis_client` (as `client`/`app` do)
has **zero effect** on the session-invalidation check — it silently falls
through the fail-open path instead (this is also why the pre-existing
`test_logout_success` / `test_get_me_*` errors show a
"Rate limiter Redis error — allowing request" log: real Redis simply isn't
reachable in this sandbox, so every request silently fails open). To test
this path at all, `test_token_blacklist.py` monkeypatches
`app.modules.auth.dependencies.get_redis` directly rather than going through
the HTTP client + dependency override. Worth fixing for testability (route
`get_current_user` through `Depends(get_redis_client)` like everything else),
but that's a code change outside this test-writing pass — flagging here per
the brief's rule against silent fixes.

### 5c. `pypdfium2` — used at runtime, missing from every dependency manifest
Discovered while writing `test_documents_pipeline.py`. `app/modules/documents/ocr_client.py`
imports `pypdfium2` for PDF text extraction — the primary/fast path, tried
*before* falling back to PaddleOCR (module docstring: "PDF → pypdfium2
(instant, no ML, handles text-based PDFs)"). It isn't installed in this
sandbox's venv, and it isn't listed in `requirements.txt` or
`pyproject.toml` at all (only `pdf2image`, used for the OCR-fallback image
conversion step, is listed) — even though `requirements.txt`'s own comments
say "text-based PDFs handled via pypdfium2 directly." In any fresh
production install following the documented dependency list, `import
pypdfium2` fails, `_pdf_to_text()` silently returns `""` and logs a warning,
and **every** PDF — even clean, text-based ones with an embedded text
layer — falls through to the slower PaddleOCR path unnecessarily.
Added `pypdfium2>=5.0.0` to `pyproject.toml`'s `dev` deps and CI (needed for
`test_documents_pipeline.py`'s real-PDF-text-extraction tests to exercise
this code path at all) — **left `requirements.txt`/production deps
untouched**, consistent with the user's "document, don't silently fix app
code" preference established for the `claim_match_endpoint` bug (finding #0).

### 5d. `httpx.ASGITransport` can't observe a genuinely never-ending SSE stream
Discovered writing `test_sse_notifications.py`. `httpx.ASGITransport.handle_async_request`
does `await self.app(scope, receive, send)` and only builds/returns its
`Response` object **after** the ASGI app callable itself returns. A
`StreamingResponse` backed by an infinite generator (both `/notifications/stream`
and `/chat/rooms/{id}/stream`) never returns, so `client.stream(...)` against
either endpoint hangs forever — verified this is a `httpx`/`ASGITransport`
limitation, not a product bug, by reproducing the identical hang with a
brand-new minimal FastAPI app with zero custom middleware and a
`asyncio.sleep(3600)`-based generator.

**Added `open_sse_stream` fixture to `tests/conftest.py`**: it drives the
FastAPI app's ASGI callable directly as a background `asyncio.Task`, with a
`receive()` that never resolves (simulating a client that stays connected)
and a `send()` that pushes messages onto a queue the test reads from — so
tests observe real event bytes as the generator actually yields them,
through the full real middleware/auth/routing stack, without needing httpx
at all. `SSEStream.aclose()` cancels the background task to simulate client
disconnect. Both `test_sse_notifications.py` and `test_chat_sse_multiuser.py`
use this fixture.

**Related gotcha this uncovered**: `app.shared.notifications`'s
`_user_subscribers`/`_role_to_users` are plain module-level dicts with no
per-test isolation (unlike DB state, which rolls back). A test that creates
an async-generator subscription and abandons it without properly cancelling
the pending `anext()` task (calling `gen.aclose()` on a generator with an
in-flight `anext()` raises `RuntimeError: aclose(): asynchronous generator is
already running` — you must cancel the task first) leaves that subscription
registered, which silently broke a *later, unrelated* test earlier in
development (the leaked subscriber state made the app inexplicably hang on a
later test that shared no fixtures with the failing one). Worth remembering
if pub/sub-related tests start flaking mysteriously.

### 5e. `/api/v1/admin/stats` uses PostgreSQL-only raw SQL
Discovered while picking a "representative success" endpoint for
`test_rbac_boundaries.py`. `get_system_stats()` (monitoring/router.py:128-171)
runs a single raw-SQL query using `jsonb_array_length`, the `->` JSONB
operator, `json_object_agg`, and a `role::text` cast — all PostgreSQL-only.
Role-gate checks (403/401) on this endpoint still work fine in tests (they
never reach the query), but actually calling it as an authorized admin
raises `OperationalError: unrecognized token: ":"` on SQLite. Switched the
matrix's "admin can access something" success check to `GET /admin/users`
(plain ORM query) instead. Exercising `/admin/stats`'s actual behavior needs
real PostgreSQL.

### 5f. moto doesn't enforce presigned-URL signature expiry at all
Discovered while writing `test_minio_signed_url_expiry.py`. Verified
empirically: generate a presigned URL with `ExpiresIn=1`, sleep 2 seconds,
fetch it via a real HTTP GET through moto's mock — it still returns 200 with
the file content. moto signs and serves objects without ever validating the
embedded expiry timestamp/signature window. This means "does an actually-expired
signed link get rejected" — the brief's literal ask — cannot be verified
against moto, and there's no MinIO/S3 available in this sandbox to verify it
against directly either (see Environment notes). What's tested instead:
that `get_presigned_url()` correctly threads the requested expiry duration
into the signing call (different durations produce different signed URLs)
and fails closed (returns `None`) if the S3 client errors. Real expiry
enforcement needs a real MinIO instance — `docker-compose.test.yml`.

### 5g. No "no match found" message shown to the client — just silence
Discovered while preparing `ui_no_match_found.spec.ts` (Phase 5).
`RFQDetailPage.tsx`'s match-result success alert only renders when
`matchResult.count > 0` — when matching runs and finds zero suppliers, no
alert, banner, or Arabic message appears at all; the UI simply doesn't show
anything beyond the "Matched Suppliers" card's pre-existing empty state
("لا يوجد"). `match_rfq_to_suppliers()` (`app/modules/intake/matcher.py`)
sets `RFQ.is_public = True` and creates zero `RFQMatch` rows in this case,
so backend state correctly reflects "no match," but nothing communicates
that to the client — a user who just ran a match with zero results sees the
exact same page as one who never ran matching. This is a UX gap, not a
crash: `ui_no_match_found.spec.ts` verifies the current (silent) behavior
directly rather than asserting a message that doesn't exist.

### 5h. No frontend page for AI-cost stats, despite a real backend endpoint
Discovered while preparing `lifecycle_admin.spec.ts` (Phase 5). `GET
/api/v1/admin/ai-costs` (`app/modules/monitoring/router.py`) is fully
implemented and admin-gated, but no `ROUTES.ADMIN` entry or page component
exists for it anywhere in the frontend — `AdminSidebar.tsx` has no link to
it either. `lifecycle_admin.spec.ts`'s "review AI-cost stats" step verifies
this at the API level directly (`page.request.get(...)`) rather than via UI
navigation, since there is currently no UI to navigate to.

### 5i. No frontend page for admin user management — sidebar links to the Settings stub instead
Discovered while preparing `lifecycle_admin.spec.ts` (Phase 5).
`AdminSidebar.tsx`'s "إدارة المستخدمين" (User Management) link routes to
`/settings` — the same static stub covered by finding #4, which has zero
data binding. The backend fully supports user management (`GET
/api/v1/admin/users`, `PUT /api/v1/admin/users/{id}/status`), but there is
no real frontend page for it. `lifecycle_admin.spec.ts` verifies this
capability at the API level directly, and separately confirms the sidebar
link does land on the (harmless, non-crashing) Settings stub rather than a
broken route.

### 5j. Supplier verification status has no UI gating anywhere — it's purely informational
Discovered while preparing `lifecycle_supplier.spec.ts` (Phase 5), which per
the original brief expects a "wait for admin verification" step before a
supplier can add products. In the real code, `SupplierProfile.verification_status`
(default `pending`) is displayed as a read-only badge on `ProfilePage.tsx`
but is never checked as a precondition anywhere: `/documents/upload`
(`app/modules/documents/router.py`), `/catalog/products/{id}/review`
(`app/modules/catalog/router.py`), and quotation endpoints all omit any
verification check. A freshly self-registered, still-`pending` agent can
upload a catalogue, get it reviewed, appear in the marketplace, and receive
exclusive matches immediately — with no blocking wait state at all.
`lifecycle_supplier.spec.ts` documents this directly: it exercises the full
flow with a still-pending supplier and confirms nothing blocks it, rather
than asserting a wait-for-verification gate that doesn't exist.

## Fixed

### F1. `RFQCreatePage`'s custom Arabic validation messages were unreachable via mouse click — FIXED 2026-07-02
Originally found writing `RFQCreatePage.test.tsx` (Phase 3): `client_name`
and `client_request_arabic` inputs both had the HTML `required` attribute,
and `handleSubmit()` had its own JS-level checks that set custom Arabic
error messages ("يرجى إدخال اسم العميل" / "يرجى إدخال طلب العميل") when
those fields were empty. Native HTML5 constraint validation intercepted the
submit event *before* React's `onSubmit` ever fired when a `required` field
was empty and the user clicked submit (verified directly against jsdom,
matching real browsers) — so those custom Arabic messages never actually
displayed; the browser's own generic validation tooltip appeared instead.

**Fix applied**: added `noValidate` to the `<form>` element in
`frontend/src/pages/rfq/RFQCreatePage.tsx`, disabling native browser
constraint validation entirely and making the existing JS-level Arabic
validation the sole source of truth (no unified form-validation library like
`react-hook-form` is actually used anywhere else in this codebase, despite
being a dependency, so this was the minimal, consistent fix rather than
introducing a new pattern for one page). `required` attributes were left in
place for their accessibility semantics (screen readers still announce them
as required) — `noValidate` only disables the *browser's blocking behavior*,
not the semantic markup.

**Test update**: `RFQCreatePage.test.tsx`'s two validation tests now use a
real `user.click()` on the submit button (previously had to use
`fireEvent.submit()` to bypass the native-validation block) — proving the
fix works via actual mouse interaction, the exact path that was broken
before. Verified: 5/5 tests pass.

### F2. `MarketplacePage`'s RFQ-modal success message was unreachable — FIXED 2026-07-02
Originally found writing `MarketplacePage.test.tsx` (Phase 3): `RfqModal`'s
`createRfqMutation.onSuccess` called `queryClient.invalidateQueries(...)`
then `onClose()` synchronously in the same handler. `onClose()` cleared
`selectedProduct` in the parent, which stopped rendering `<RfqModal>`
entirely (`{selectedProduct && <RfqModal .../>}`) — unmounting it before its
local `isSuccess` state could ever cause a re-render showing "تم إرسال طلب
عرض السعر بنجاح". A user submitting a valid RFQ saw the modal simply close,
with no visual confirmation the request succeeded.

**Fix applied**: `onSuccess` now calls `toast.success("تم إرسال طلب عرض
السعر بنجاح")` (`react-hot-toast`, rendered via the `<Toaster/>` already
mounted in `ClientLayout`/`AgentLayout`/`AdminLayout`) before `onClose()`.
This matches the codebase's existing, established pattern for success/error
confirmations (`useAuth.ts`'s login/register/logout all use the same
`toast.success`/`toast.error` calls) — no other modal in this codebase shows
success messages in-place, so an independent toast was the consistent
choice, not a one-off. Also removed the now-fully-dead inline "Success
State" JSX block and its unused `isSuccess`-gated `CheckCircle` render (the
`isSuccess` disabled-state check on the submit button was left as-is —
harmless and unrelated to the visibility bug).

**Test update**: `MarketplacePage.test.tsx` now mocks `react-hot-toast` and
asserts `toast.success` is called with the exact confirmation message after
a successful RFQ submission — the real regression guard, replacing the
previous assertion that only checked the modal closed. Verified: 7/7 tests
pass.

### F3. SECURITY — `POST /api/v1/auth/register` allowed unauthenticated privilege escalation to admin — FIXED 2026-07-02
Originally finding #0e (Phase 4): `UserCreate.role` accepted any string with
no schema-level restriction, and `register_user()` (`app/modules/auth/service.py`)
only checked the value was *a* valid `UserRole` member — never whether the
(unauthenticated) caller was allowed to request that role. `role="admin"` on
the public signup endpoint returned a fully-privileged admin account with no
auth check anywhere in the call path.

**Fix applied**: `app/modules/auth/service.py` now defines
`SELF_REGISTERABLE_ROLES = (UserRole.CLIENT, UserRole.AGENT)` and
`register_user()` rejects any role outside that whitelist — including
`admin` — with a `ValidationError` (422), regardless of what the request
body contains. `admin` is excluded explicitly, not just "whatever doesn't
match" left over from the enum, so adding a future non-self-registerable
role later can't accidentally fall through. `app/modules/auth/schemas.py`'s
`role` field description and `app/modules/auth/router.py`'s endpoint
docstring were updated to state plainly that admin cannot be self-registered.
Admin provisioning remains an internal-only operation (direct DB insert —
see `tests/conftest.py`'s `admin_headers` fixture and
`e2e/tests/helpers/testDb.ts`'s `createAdminUserDirectly`); there is
currently no admin-only "create user with arbitrary role" endpoint, which is
fine since nothing needs one yet.

**Regression tests added**:
- `tests/security/test_rbac_boundaries.py::TestRegistrationRoleEscalation` —
  asserts an unauthenticated `role="admin"` registration attempt is rejected
  (`admin` absent from the schema's `valid_roles` list) and that legitimate
  `client`/`agent` self-registration still works.
- `tests/test_auth/test_auth_api.py::TestRegister::test_register_admin_rejected`
  (replacing the old `test_register_admin_success`, which had asserted the
  vulnerability's behavior as if it were a correct feature).

**Fixture fallout fixed in the same pass**: three pre-existing test fixtures
(`tests/test_documents/test_documents_api.py::admin_headers` and an inline
admin registration in `test_upload_requires_agent_or_admin`,
`tests/test_pricing/test_pricing_api.py::admin_headers`,
`tests/test_pricing/test_hs_code_pricing.py::admin_headers`) created their
admin test user via this same now-blocked `/auth/register` path. All four
were switched to the same direct-DB-insert pattern already used by
`tests/conftest.py`'s top-level `admin_headers` fixture.

**Verified**: full `tests/security/` (118/118), `tests/test_auth/`,
`tests/test_documents/`, and `tests/test_pricing/` all pass with no new
failures — confirmed via before/after diff against the pre-fix baseline
(same pre-existing failures in both, e.g. weak test passwords in
`test_register_agent_success`/`test_register_client_success` and fake-PNG
upload validation in `test_documents_api.py`, none introduced by this fix).
Also verified directly against the real endpoint (not mocked): a
`role="admin"` registration attempt returns 422 with `admin` excluded from
`valid_roles`, while `client`/`agent` registrations with the exact payload
shape the frontend now sends (see F4) both return 201 and a working login
token.

### F4. `RegisterPage.tsx`'s self-registration form was broken for both roles — FIXED 2026-07-02
Originally finding #0d (Phase 4): the form only collected `full_name`,
`email`, `phone`, and `password` — no input existed for `company_name`
(required for `client`) or `factory_name`/`location_in_china` (required for
`agent`), so every real registration submitted through the UI failed
server-side with a validation error, for either role.

**Fix applied**:
- `frontend/src/types/auth.ts`'s `UserCreate` gained optional
  `company_name`, `factory_name`, `location_in_china` fields, and `role` was
  narrowed from `"agent" | "admin" | "client"` to `"agent" | "client"` —
  matching F3's backend restriction (admin was never a real option here).
- `frontend/src/pages/auth/RegisterPage.tsx` now renders the company-name
  field when the client tab is active, and the factory-name/location-in-China
  fields when the agent tab is active, and includes whichever set applies in
  the `register()` call.
- Added `noValidate` to the `<form>` plus explicit Arabic client-side
  validation in `handleSubmit` (full name, email, password length, password
  match, and the active tab's required profile field) — the same fix pattern
  as F1, applied proactively here so this form doesn't hit the identical
  native-`required`-intercepts-custom-message bug.
- `frontend/src/hooks/useAuth.ts`'s `register()` error extraction was reading
  `error.response.data.detail` (FastAPI's default shape), but this backend's
  actual error shape is `{"error": {"message": ...}}`
  (`app/shared/error_handlers.py`) — so any server-side rejection was
  silently replaced by a generic fallback message instead of the real reason.
  Fixed to read `error.response.data.error.message`.

**Test update**: added `frontend/src/pages/auth/__tests__/RegisterPage.test.tsx`
(4 tests) — successful registration for both roles with the correct payload
per role, and a real `user.click()` on the submit button proving the correct
Arabic message appears for a missing `company_name` (client tab) and a
missing `factory_name` (agent tab). Verified: 4/4 pass, and the full frontend
suite (10 files / 54 tests) passes with no regressions.

**Verified against the real backend** (not mocked): a direct integration
check sent the exact payload shape `RegisterPage.tsx` now produces for both
roles to the real `/auth/register` → `/auth/login` flow — both return 201
then a working access token. A Playwright E2E spec
(`e2e/tests/e2e_register_full_cycle.spec.ts`) exercising the real browser UI
for both roles was also added, verified for syntax/discovery only
(`tsc --noEmit`, `playwright test --list`) — actual browser execution
requires Docker, unavailable in this sandbox, consistent with the rest of
Phase 4.

### F5. Pricing engine — exchange rate self-corrupted on every `/calculate` call — FIXED 2026-07-02
Discovered while seeding realistic demo data and building two real quotations
back-to-back through the live API (Docker available in this session, so this
was caught against real Postgres/Redis, not SQLite). The second quotation's
`exchange_rate_used` came back at `5.34` (vs. `0.1047` for the first) —
implausible for a CNY→JOD rate that hadn't changed.

Root cause: `PricingEngine.calculate_landed_cost()` (`app/modules/pricing/engine.py`)
returned `usd_rate` (the intermediate USD→JOD ratio, `cny_to_jod / cny_to_usd`
≈ 0.748) as `exchange_rate_used`, not the raw CNY→JOD rate (≈0.1047) that was
actually fetched/cached. `calculate_price()` (`app/modules/pricing/service.py`)
then wrote that mislabeled value straight back into the Redis
`pricing:exchange_rate:CNY:JOD` cache key. The next `/calculate` call read
that corrupted value back in as if it were the raw CNY→JOD rate and divided
it by `cny_to_usd` (0.14) *again* — compounding on every single call
(reproduced: 0.1047 → 0.748 → 5.34 → 38.16 → ...). Because
`EXCHANGE_RATE_API_KEY` in this environment is a placeholder
(`test_exchange_rate_key`), the live-fetch fallback that would otherwise
overwrite the cache with a fresh correct value always fails silently, so the
corruption never self-heals — every quote built after the first one would
have been off by a compounding ~7.14x factor, indefinitely, in any
environment with the same invalid/missing API key.

**Fix applied**: `calculate_landed_cost()` now returns the true
CNY→target_currency rate (`cny_to_usd` for USD, `cny_to_jod` for JOD/fallback)
as `exchange_rate_used`, instead of the derived USD→JOD ratio. Verified: three
consecutive `/calculate` calls now return an identical `exchange_rate_used`
(0.1047), and the two demo quotations (RFQ C/D, deleted and regenerated after
the fix) show stable, sane totals. `tests/test_pricing/test_pricing_api.py`'s
`TestCalculateLandedCost` suite (8 tests) passes unchanged — no test asserted
the old (wrong) `exchange_rate_used` value.

### F6. Pricing engine — freight/volume never scaled with quantity — FIXED 2026-07-02
Found immediately after F5 while sanity-checking the regenerated demo quotes:
5,000 meters of light cable (0.35 kg/unit) priced with `freight_cost = 0`
(rounded to zero), while 15 heavy generators (950 kg/unit) showed the *same*
freight total regardless of how many units were requested.

Root cause: `calculate_landed_cost()` computed `volume_cbm =
estimate_volume_cbm(weight_kg)` from a single unit's weight only, then divided
the resulting (tiny, single-unit) freight by `quantity` a second time when
deriving `freight_per_unit` — so freight shrank toward zero as quantity grew
instead of staying roughly constant per unit, and never reflected the total
shipment size at all.

**Confirmed with the user this needed an explicit semantic decision** before
fixing (existing unit tests in `tests/test_pricing/test_pricing_api.py` had
locked in the buggy behavior — same `weight_kg=500` producing an identical
`volume_cbm=1.0` regardless of quantity 10 vs. 100 — even though the
docstring says `weight_kg` is per-unit). Decision: `weight_kg` is the
PER-UNIT weight, matching `CatalogProduct.weight_kg` and what the frontend
sends; the total shipment weight (`weight_kg * quantity`) must be estimated
into a volume, not the per-unit weight alone.

**Fix applied**: `calculate_landed_cost()` now computes
`total_weight_kg = weight_kg * quantity` and passes that into
`estimate_volume_cbm()`. `freight_per_unit` now stays ~constant when only
quantity changes (same per-unit weight) and scales linearly with per-unit
weight when quantity is held constant.

**Tests updated**: `test_basic_calculation` and `test_jeddah_port` in
`tests/test_pricing/test_pricing_api.py` had their expected `volume_cbm` /
`freight_per_unit` values recalculated for the new (correct) semantics. Added
`test_freight_scales_with_quantity_not_inversely` as an explicit regression
guard: same per-unit weight at quantity 10 vs. 1000 now yields identical
`freight_per_unit` (previously ~100x apart), and doubling per-unit weight at
fixed quantity scales `freight_per_unit` proportionally. Full
`tests/test_pricing/` suite verified before/after: identical pre-existing
baseline (1 failed / 25 errors, both SQLite/environment-only per the
"Environment notes" section below) plus the new test passing — zero
regressions.

**Verified end-to-end against real demo data**: the two demo quotations (RFQ
C: 5,000m of cable at 0.35 kg/unit; RFQ D: 15 generators at 950 kg/unit) were
deleted and regenerated through the live `/pricing/calculate` →
`/quotes` → `/quotes/{id}/finalize` pipeline after both F5 and F6. Freight for
the cable shipment is now JOD 250 (previously JOD 0) and freight for the
generator shipment is JOD 2,137.50, correctly reflecting each shipment's real
total weight rather than being either zeroed out or quantity-independent.

### F7. Agent Dashboard Kanban cards showed randomized fake data on every render — FIXED 2026-07-02
Discovered while walking through the agent's screens with the freshly-seeded
demo data. `AgentDashboard.tsx`'s `KanbanCard` displayed
`Math.floor(Math.random() * 40000) + 5000` as the deal's dollar amount (only
used when `rfq.amount` was unset — but `RFQResponse` never has an `.amount`
field at all, so this path fired on *every* card, every render, producing a
different fake number each time) and `Math.floor(Math.random() * 900 + 100)`
as the unit-quantity badge — completely disconnected from each RFQ's real
seeded product (e.g. a real "5,000 meters of cable" RFQ displayed as "765
وحدة" / "$14,476"). The same component also showed a live countdown
("ينتهي خلال" / expires-in) built from a hardcoded `Date.now() + 5.8h`
offset for any RFQ with `status === "quoted"`, regardless of whether that RFQ
had a real `exclusive_deadline` at all — fabricating urgency. The page header
greeting was a hardcoded literal date string ("الإثنين، ٣٠ يونيو ٢٠٢٥"), and
the "إيرادات الشهر" (revenue this month) stat card was hardcoded to the
literal string `"JD 24,580"` (its `value` field was always `null`), with all
four stat cards additionally showing invented, never-computed trend text
("↑ 3 هذا الأسبوع", "↑ 23% نمو", "↑ 18% عن الماضي").

**Fix applied** (`frontend/src/pages/dashboard/AgentDashboard.tsx`): wired up
the already-existing (but previously unused-here) `intakeService.listProductsBatch()`
to fetch real per-RFQ products in one batched call, and derive each card's
quantity (`sum(product.quantity)`) and estimated value
(`sum(product.quantity * product.target_price)`, shown with the RFQ's real
`target_currency`) from that — hiding the value line entirely (`—`) rather
than showing a fabricated number when no `target_price` data exists. The
countdown now only renders when `rfq.exclusive_deadline` is a real, future
timestamp. The header date now calls
`new Date().toLocaleDateString("ar-JO", {...})`. The revenue stat now sums
`grand_total` from real `status=accepted` quotations
(`quotationService.list`) created in the current calendar month, showing `—`
when there are none instead of a hardcoded figure. The four invented trend
lines were removed rather than replaced with new fabricated ones (no
real "vs. last week/month" computation exists yet to back them).

**Verified**: re-seeded demo data now renders exact real quantities (5000,
15, 8, 300, 50 — matching each seeded product exactly) and currency-correct
estimated values (e.g. `USD 60,000` for the one demo RFQ priced in USD vs.
`JOD` for the rest) with zero console errors; `npx tsc --noEmit` clean.

### F8. Hard refresh on any RoleGuard-protected route (or `DashboardRouter`) silently bounced back to login even with a valid session — FIXED 2026-07-02
Discovered while testing the Quote Builder: clicking "إنشاء وإرسال عرض السعر"
on a freshly-hard-reloaded RFQ detail page always landed back on `/auth/login`
instead of the quote builder — reproducible every time, not a one-off.

Root cause: `useAuthStore` (`frontend/src/stores/authStore.ts`) rehydrates
`accessToken`/`isAuthenticated` from `localStorage` at store creation, but
`user`/`role` are **only** ever set via `setAuth()`/`setUser()` — both called
solely from the login flow (`useAuth.ts`). Nothing calls `/auth/me` to
repopulate them after a page reload, even though `useAuth.ts` already exports
a ready-made `fetchMe()` for exactly this purpose — it was simply never
invoked anywhere (confirmed via repo-wide grep: zero call sites). So after
any hard refresh, new tab, or direct link open while logged in: `isAuthenticated`
stays `true` (token present) but `role` is `null` forever. `RoleGuard`
(`components/auth/RoleGuard.tsx`) treats `!role` as unauthorized and redirects
to its `redirectTo` prop — for `/rfq/:id/build-quote`, `/catalog/review`,
`/rfq/supplier-inbox` etc. that's `/dashboard` — but `DashboardRouter.tsx`
*itself* also gates on `role` and redirects unconditionally to `/auth/login`
when it's null, producing a two-hop redirect that lands on the login page.
Any hard refresh while using the quote builder, product review, or supplier
inbox — or simply opening one of those links in a new tab — silently kicked
the (still-logged-in) user back to login with no error message.

**Fix applied**: `ProtectedRoute.tsx` (which already wraps every authenticated
route) now rehydrates `user`/`role` via `authService.getMe()` on mount
whenever `isAuthenticated` is true but `role` is still missing, showing a
brief centered spinner while that single request is in flight, before
rendering `<Outlet/>`. On failure (token actually invalid/expired) it calls
`logout()` so the existing "redirect to login" path still fires correctly for
truly-expired sessions.

**A second bug surfaced while fixing the first**: the initial implementation
set `bootstrapping` to `false` inside a `.finally()` chained after `.then()`.
Because `setUser()` changes `role` — one of this effect's own dependencies —
React re-runs the effect (firing its cleanup, which flips a local `cancelled`
flag to `true`) *before* the separate `.finally()` microtask got a chance to
run, so the `if (!cancelled)` guard in `.finally()` permanently skipped
`setBootstrapping(false)`, leaving every protected route stuck on the loading
spinner forever after the very first successful bootstrap. Fixed by setting
`setBootstrapping(false)` inside the same `.then()`/`.catch()` callback as
`setUser()`/`clearAuth()` (same tick, no separate `.finally()`), so both
state updates commit together before the dependency-change cleanup can race
it. Caught by direct reproduction with response/console logging attached,
not by inspection — worth remembering as a general pattern (an effect must
not gate its own "loading finished" flag behind a cancellation token that a
dependency change inside the same effect can flip first).

**Verified**: reproduced the original bug 3× consistently via Playwright
(hard-reload to an RFQ detail page, then client-side-navigate into the quote
builder), confirmed the fix keeps the user on `/rfq/:id/build-quote` instead
of bouncing to login, and confirmed (via console instrumentation) `/auth/me`
resolves and the spinner clears within one render cycle. `npx tsc --noEmit`
clean.

### F9. Quote Builder ignored the RFQ's real Product row — always priced quantity=1 and a generic "منتج" name — FIXED 2026-07-02
Discovered testing the quote builder for RFQ B (8 industrial distribution
panels, seeded as a real `Product` row): the page displayed "الكمية: 1 وحدة"
and "المنتج: منتج" instead of the real quantity (8) and product name.

Root cause: `QuoteBuilderPage.tsx`'s `extractPricingInput()` derives
quantity, product name, model number, *and* unit price entirely from
`rfq.extracted_entities` (a JSONB blob populated only by the AI
translate/extract pipeline) — never from the RFQ's actual `Product` row(s),
which is the structured, always-present source of truth used everywhere else
in the app (`RFQDetailPage`, `RFQListPage`, the agent dashboard, and this
same seed data). Any RFQ whose product was added via the normal "add
product" flow instead of AI translation (which includes every RFQ this
seed script creates, and plausibly many real agent-created RFQs) silently
priced the wrong quantity with no error or warning — a client asking for 8
units would get quoted for 1, unless the agent happened to notice and
mentally cross-check against the raw request text above it.

**Fix applied**: `QuoteBuilderPage.tsx` now also fetches the RFQ's products
via the same `intakeService.listProducts()` already used elsewhere, and
`extractPricingInput()` prefers the first real `Product` row's `quantity`/
`name` when one exists, falling back to `extracted_entities` only when no
Product rows exist. Unit price intentionally still comes only from
`extracted_entities` (`Product.target_price` is the client's budget guess in
the target currency, not a CNY supplier price — mixing the two would
silently feed the wrong currency into the pricing engine) — the existing
manual-CNY-entry fallback UI already handles that gap correctly.

**Verified**: RFQ B's quote builder now shows "الكمية: 8 وحدة" and "المنتج:
لوحة توزيع كهربائي رئيسية MDB" (the real seeded name); `npx tsc --noEmit`
clean.

### F10. Quote Builder's cost breakdown rows didn't sum to the displayed grand total, and showed a VAT figure that would never match what actually gets saved — FIXED 2026-07-02
Discovered while testing the shipping-cost override (the exact check the
demo brief calls out as critical): entering a manual freight value produced
a breakdown where "المجموع" (291.10) + "الشحن" (500.00) + "ضريبة القيمة
المضافة" (101.39) summed to 900.49 — but "الإجمالي الكلي" directly below it
showed 807.79. The numbers visibly didn't add up on screen.

Root cause, two compounding issues in `QuoteBuilderPage.tsx`:
1. The row labeled "المجموع (**بدون شحن** وضريبة)" ("subtotal, without
   shipping or tax") actually displayed `calc.subtotal_before_vat`, which
   the pricing engine computes *with* the auto-calculated freight already
   folded into each line's `total_per_unit` (see `engine.py`) — the label
   was simply false.
2. The VAT row displayed `calc.vat + (freightDiff * 0.16)` — manually
   inflating VAT by 16% of the operator's freight override — even though
   the pricing engine explicitly excludes freight from the VAT base (CIF +
   duty only; this was the whole point of the earlier, already-shipped
   "corrected VAT base" fix visible in `engine.py`'s comments). Worse: this
   inflated number was **display-only** — `buildPayload()` (used to actually
   create the quotation) correctly sends the unmodified `calc.vat` — so the
   VAT figure shown live while editing would never match what gets saved to
   the quotation record or rendered in the PDF once sent. Meanwhile
   `calc.discount_total` (early-payment/MOQ discount) wasn't shown anywhere
   in this summary at all, silently accounting for the rest of the gap.
   The grand total itself (`calc.grand_total + freightDiff`) was always
   correct — only the breakdown rows explaining it were wrong.

**Fix applied**: "المجموع" now shows `calc.subtotal_before_vat - autoFreight`
(so the "without shipping" label is actually true), VAT shows the real
unmodified `calc.vat` (matching exactly what `buildPayload()` sends), and a
new "الخصم" (discount) row shows `-calc.discount_total` when present. The
four rows now reconcile exactly: goods (291.10) + freight (500.00) − discount
(5.98) + VAT (22.67) = 807.79, matching "الإجمالي الكلي" to the cent.

**Verified**: reproduced against RFQ B (8 panels) with unit price 150 CNY and
a 500 JOD freight override, confirmed via direct `/pricing/calculate` API
call that the underlying numbers (291.10 / 22.59-ish / 5.97 discount /
315.18 baseline grand total) match what's rendered exactly; `npx tsc
--noEmit` clean; re-verified the four displayed rows sum to the grand total
both at baseline (auto freight) and after overriding freight.

### F11. `ProductReviewPage` had no navigation entry point anywhere in the app — FIXED 2026-07-02
Discovered while testing the product-approval flow: the real route is
`/supplier/review` (`ROUTES.SUPPLIER.REVIEW`), but `AgentSidebar.tsx`'s
"الكتالوجات" (Catalogs) link actually points to `ROUTES.DOCUMENTS.UPLOAD`,
and grepping the whole frontend for `SUPPLIER.REVIEW`/`ProductReviewPage`
turned up zero `<Link>`/`<NavLink>`/`navigate()` call sites anywhere. The
page only existed if you already knew the exact URL — not reachable via any
click path, which matters directly for this demo since it's one of the
required screens to show live.

**Fix applied**: added a "مراجعة المنتجات" nav item to `AgentSidebar.tsx`
pointing at `ROUTES.SUPPLIER.REVIEW`.

**A second, real bug found while seeding data to test this screen**:
`review_product_endpoint` (`app/modules/catalog/router.py`) manually
reconstructs its `CatalogProductResponse` instead of reusing
`service._to_response()`, and simply omitted `review_status` — every
approve/reject call returned `"review_status": null` in the response body
even though the underlying DB write was correct (verified directly against
Postgres: the row's `review_status` was properly `approved`/`rejected`).
Harmless today only because the frontend re-fetches the pending list via
`invalidateQueries` rather than trusting this response, but a real, visible
API defect for any other caller (or a future frontend feature) reading this
field. Fixed by adding the missing field to the response construction.

**Verified end-to-end**: seeded 2 pending catalog products for the demo
agent (`scripts/seed_demo_agent.py`), approved one via the UI, confirmed via
a direct `GET /catalog/products?category=Lighting` call that it now appears
in the public marketplace catalog (the actual check the demo brief asks
for — not just that the button changed state), rejected the other and
confirmed it correctly stays out of the pending list and the marketplace.
Re-ran the review endpoint directly afterward and confirmed
`review_status` now comes back correctly (`"approved"`) instead of `null`.
`tests/` catalog-related suites (`test_review_status_gate.py`,
`test_rbac_boundaries.py`'s catalog cases) verified before/after: identical
baseline (4 passed / 11 pre-existing SQLite-only errors), zero regressions.

### F12. CRITICAL — the live "send quote to client" button crashed every single time, and even fixed, never actually sent anything — FIXED 2026-07-02
Discovered testing the core RFQ → Quote → Send workflow end-to-end through
the real UI (my seed script had exercised the *synchronous* `/quotes` →
`/quotes/{id}/finalize` → `/quotes/{id}/status` pipeline directly via HTTP,
which masked this — the actual "إرسال عرض السعر للعميل" button in
`QuoteBuilderPage.tsx` hits a completely different endpoint,
`POST /quotes/generate`). Clicking it in a real browser session crashed with
a 500 every time.

**Bug 1 — crash.** `QuoteBuilderPage.tsx`'s pricing-calculate request always
sent `product_id: rfqId` (the RFQ's own id) as a placeholder — harmless at
calculate-time since `/pricing/calculate` never validates it — but
`buildPayload()` then carried that same value straight through into the
quotation-creation payload's line item `product_id`, which **is** a real
foreign key to `products`. Since an RFQ's id is never a valid Product id,
every call failed: `IntegrityError: ForeignKeyViolationError ... Key
(product_id)=(<rfq-id>) is not present in table "products"`. The UI showed
nothing but a generic, untranslated "An unexpected error occurred" — no
detail, not even in Arabic. Fixed by using the RFQ's real `Product` row's id
(fetched via the same `products` query added for F9) instead of `rfqId`,
falling back to `undefined` (the column is nullable) when no real product
exists.

**Bug 2 — even after fixing the crash, nothing was actually sent.**
`POST /quotes/generate` (`create_quotation` + Celery `generate_quotation_pdf_task`)
only ever creates a `DRAFT` quotation and, once the background task
finishes, sets `pdf_path`/`pdf_generated_at` — it never touches
`quotation.status` or `rfq.status` at all. Nothing anywhere in the app calls
`/quotes/{id}/finalize` or `/quotes/{id}/status?new_status=sent`
automatically. `QuotationDetailPage.tsx` (where the button correctly
navigates to afterward) had accept/reject buttons for the **client** role
but zero actions for the **agent** role — no way to progress a quote past
`draft` at all through the UI. A quote an agent believed they'd "sent"
silently sat in draft forever; the client would never see it as sent, and
the RFQ's own status/dashboard never reflected it either.

**A third, related gap found while wiring the fix**:
`quotationService.updateStatus()` (unused — zero call sites anywhere before
this fix) sent `status` as a JSON request body, but
`PUT /quotes/{id}/status`'s `new_status: QuotationStatus` parameter has no
body model, so FastAPI binds it as a **query parameter** — this call would
also have failed (422) the moment anything tried to use it.

**Fix applied**:
- `QuoteBuilderPage.tsx`: use the real product id in the quotation payload
  (see Bug 1).
- `quotationService.ts`: fixed `updateStatus()` to send `new_status` as a
  query param (matching the real backend contract) and added a `finalize()`
  method (the `/quotes/{id}/finalize` endpoint already existed and worked —
  it just had no frontend caller).
- `QuotationDetailPage.tsx`: added an "إرسال العرض للعميل" button, visible
  to agent/admin when `status` is `draft`/`finalized`, that calls
  `finalize()` then `updateStatus(id, "sent")` — the same two-step sequence
  already proven by `scripts/seed_demo_agent.py`'s direct HTTP calls.
- `app/modules/output/service.py`'s `finalize_quotation()`: broadened the
  RFQ-status-advance condition from "only if currently `PROCESSING`" to "if
  currently `OPEN` or `PROCESSING`" — an agent finalizing a quote straight
  from a brand-new, never-explicitly-"processing" RFQ (the common case, and
  exactly what building a quote from an `open` RFQ does) previously left the
  RFQ stuck showing `open` forever even after a quote had been fully built,
  finalized, and sent to the client.

**Verified end-to-end through the real UI**: built and sent a live quote for
RFQ A (300× LED highbay fixtures) — reproduced the original crash, applied
the fix, re-ran the identical flow with zero console/network errors, watched
the quotation detail page's status badge flip from "مسودة" (draft) to "تم
الإرسال" (sent) after clicking the new button, and confirmed via direct DB
query that the parent RFQ's status advanced from `open` to `quoted`. Reset
the RFQ/quotation this test created back to the seed script's intended
`open`/no-quote state afterward so the demo narrative stays intact.
`npx tsc --noEmit` clean. `tests/test_output/` verified before/after:
identical baseline (1 failed / 17 pre-existing SQLite-only errors / 37
passed), zero regressions.

### F13. Every absolutely/fixed-positioned overlay whose trigger sits in a small container could render clamped to a sliver — FIXED 2026-07-02
Discovered opening the notification bell: the dropdown (`w-80` = 320px)
rendered as an unreadable ~36px-wide vertical strip with wrapped, illegible
Arabic text, even though its header ("الإشعارات") and empty-state message
("لا توجد إشعارات") were both correctly present in the DOM.

Root cause: `frontend/src/index.css` has a global rule —
`*, *::before, *::after { max-width: 100%; }` — added (per its own comment)
to "prevent horizontal overflow on mobile." For an absolutely-positioned
element, `max-width: 100%` resolves against its *containing block* (the
nearest positioned ancestor), not the viewport. The notification bell's
containing block is a `<div className="relative">` sized to fit only the
36px bell icon button, so the dropdown's explicit `w-80` was overridden down
to 36px. This is a systemic gap, not specific to notifications — any
`absolute`/`fixed` overlay anchored inside a small inline trigger anywhere
in the app is subject to the same clamping.

**Fix applied**: added `.absolute, .fixed { max-width: none; }` immediately
after the blanket rule in `index.css`, scoped to exactly the two Tailwind
position-utility classes every overlay in this codebase already uses to
position itself — restoring their intended explicit widths while leaving
the original mobile-overflow protection intact for normal in-flow content.

**Verified**: notification dropdown now renders at its intended 320px with
fully readable text; confirmed via `getComputedStyle` before/after
(`width: 36px` → `width: 320px`) and a direct stylesheet query showing
exactly which rule was clamping it (`*, ::before, ::after { max-width:
100%; }`) before the fix. Not exhaustively re-tested against every overlay
in the app (out of scope for this pass), but flagging here since other
`absolute`/`fixed` popovers elsewhere may have had the same latent issue
masked only by happening to sit inside a wide enough trigger.

## Deviations from the original test-planning brief

### 6. `useRoomSSE.ts` doesn't exist as a file
The brief assumed a `useRoomSSE.ts` hook mirroring `useNotifications.ts`. In
reality, the chat room's real-time logic is inline inside
`frontend/src/pages/chat/ChatRoomDetailPage.tsx` (uses `fetch()` + manual SSE
parsing, not `EventSource`, because `EventSource` can't send auth headers).
Phase 3 tests target `ChatRoomDetailPage.test.tsx`, not a nonexistent hook file.

### 7. Celery Beat exclusive-window task already exists
The brief flagged the "flip RFQ from exclusive to public" scheduled task as
uncertain, with instructions to build it test-driven if missing. It already
exists: task `expire-stale-matches` (`app/modules/intake/tasks.py:45-116`),
scheduled every 5 minutes (`app/shared/celery_app.py:67-80`).
`test_exclusive_window_expiry.py` is a regression test of existing behavior.

### 8. Real Redis via testcontainers → fakeredis
The original plan (confirmed with the user) was real Redis via
`testcontainers`. This sandbox/CI environment has no Docker daemon available,
so `tests/conftest.py`'s `redis_client` fixture uses **fakeredis** instead —
a pure-Python Redis command-set emulation (TTL, `SETEX`, `SCAN`, pipelines,
`ZADD`, etc. all behave like real Redis) that needs no daemon. This is
strictly more portable than testcontainers and was verified against every
Redis command pattern actually used in `app/` (auth blacklist, pricing cache
locks, circuit breaker, rate limiter). `testcontainers[postgres]` remains in
`pyproject.toml` as a pre-existing, currently-unused dependency — out of scope
to remove here.

### 9. No frontend Dockerfile → Playwright `webServer` instead of a compose service
The brief's `docker-compose.test.yml` sketch listed a "frontend" service. The
repo has no frontend Dockerfile (frontend deploys to Vercel — see
`frontend/vercel.json`). `docker-compose.test.yml` therefore only containerizes
backend + postgres + redis + minio + celery worker/beat (isolated ports
5433/6380/9010-11/8001, no persistent volumes); `e2e/playwright.config.ts`'s
`webServer` starts `vite dev` for the frontend directly, pointed at the
containerized backend on port 8001.

### 10. Load tests deferred
Per user decision, Locust load tests (`locustfile_pricing.py`,
`locustfile_sse_channels.py`, Celery queue backpressure) are not written in
this pass — revisit once the core suite is stable.

### 11. Visual regression tests (Storybook + Chromatic/Percy) deferred
Per user decision (same reasoning as Load tests): Chromatic and Percy both
require an external SaaS account + API token that can't be created in this
session, and installing Storybook is a substantial new toolchain addition on
its own. Deferred entirely rather than half-setting-up Storybook with no
visual-diffing backend to actually use it — revisit once a Chromatic/Percy
account exists. The RTL-layout-focused component checks the brief wanted
(top 10 components, no flipped/misaligned elements) are partially covered
functionally by the component tests already written in this phase
(`PricingCalcPage`, `RFQCreatePage`, `ChatRoomDetailPage`, `LoginPage`,
`AdminLoginPage`, `ProductReviewPage`, `MarketplacePage`, `SettingsPage` —
all render real RTL Arabic content and assert on it), but none of that is a
substitute for actual pixel-level visual regression detection.

## Environment notes (for whoever runs this suite next)

- Docker is not available in the sandbox this suite was built in — the
  Playwright config and `docker-compose.test.yml` are verified for syntax/
  resolution (`docker compose config`, `playwright test --list`) but not for
  an actual end-to-end run. Run `docker compose -f docker-compose.test.yml up
  -d --build` and `npx playwright install --with-deps chromium` in an
  environment with Docker before executing Phase 4/5 E2E specs.
- Existing pre-Phase-1 test failures (20 failed / 47 errors in
  `tests/test_auth`, `tests/test_documents`, `tests/test_intake`,
  `tests/test_output`, `tests/test_pricing`) are unchanged by this work —
  confirmed via before/after comparison. These are pre-existing bugs unrelated
  to test infrastructure and are out of scope for Phase 1; flagging here so
  they aren't mistaken for regressions introduced by this effort.
- `npx vitest run` (default parallel forked workers) times out entirely in
  this sandbox (`Timeout waiting for worker to respond` — a resource/process
  limit, not a test failure). Use `npx vitest run --no-file-parallelism` here;
  all 9 frontend test files (50 tests) pass cleanly under it. A normal
  dev machine or CI runner likely won't hit this — it's specific to this
  sandbox's constraints.
- Phase 4 (`e2e/`) was verified the same way: `npx tsc --noEmit` is clean
  across the whole package, and `npx playwright test --list` discovers all
  6 `.spec.ts` files (13 tests: `contract/pact_frontend_backend`,
  `e2e_auth_full_cycle`, `e2e_exclusive_to_public_transition`,
  `e2e_full_customer_journey`, `e2e_live_chat_two_tabs`,
  `e2e_quote_pdf_download`). None were actually executed — that requires
  `docker compose -f docker-compose.test.yml up -d --build` plus
  `npx playwright install --with-deps chromium`, neither available here.
  The two `tests/synthetic/*.ts` scripts (`synthetic_health_check.ts`,
  `synthetic_sse_uptime.ts`) are intentionally excluded from Playwright's
  test run (filenames don't match `.spec.`/`.test.`, per the brief's
  "schedulable via external cron" requirement) — they're standalone
  scripts meant to run against a real deployed environment, not this test
  suite's own Docker topology, and were only checked for `tsc` correctness.
  `synthetic_sse_uptime.ts` is explicitly written to treat a connection
  drop coinciding with a rolling restart as an **expected, documented**
  failure mode (see finding #6 above on in-memory SSE), not a false alarm
  to be suppressed.
