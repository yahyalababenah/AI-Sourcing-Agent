# Project Status — AI-Sourcing Hub

## ✅ Completed: Client Experience Epic
All 4 features fully implemented and tested:

| Feature | Leaves | Status |
|---------|--------|--------|
| Product Discovery (search, filters, DB indexes) | 4/4 | ✅ |
| RFQ & Quote Lifecycle (create, supplier inbox, quote, accept) | 5/5 | ✅ |
| Order Tracking (timeline, status updates, auto-refresh) | 4/4 | ✅ |
| Customs & Landed Cost Engine (rules, calc, admin UI, breakdown) | 4/4 | ✅ |

## Next Up: Supplier Experience Epic
The next logical epic to tackle. Three features with varying progress:

### Feature A: Supplier Onboarding & Verification (`ai-supplier-auth`)
| Leaf | Status | Description |
|------|--------|-------------|
| leaf1 | ✅ completed | Registration form (RegisterPage.tsx) |
| **leaf2** | **🔶 active** | **Supplier Profile Schema Expansion** — Add `business_license_url`, `verification_status`, `factory_address` + migration |
| leaf3 | ✅ completed | Document Upload to MinIO |
| leaf4 | ⏳ pending | Admin Verification Dashboard (approve/reject) |

### Feature B: Supplier Digital Catalog (`ai-supplier-catalog`)
| Leaf | Status | Description |
|------|--------|-------------|
| leaf1 | ⏳ pending | Backend: filter catalog by supplier UUID |
| leaf2 | ⏳ pending | Frontend: supplier showroom for clients |
| leaf3 | ⏳ pending | Frontend: "My Products" management panel |

### Feature C: Chat / Negotiation Rooms
- Placeholder — no leaves defined yet.

## Proposed Next Task: Supplier Profile Schema Expansion

**What needs to change:**

**1. Model** [`app/modules/auth/models.py`](app/modules/auth/models.py:105) — `SupplierProfile`:
   - Add `business_license_url` (String, nullable) — MinIO URL
   - Add `verification_status` (Enum: `PENDING` / `VERIFIED` / `REJECTED`, default `PENDING`)
   - Add `factory_address` (Text, nullable) — detailed factory address

**2. Schemas** [`app/modules/auth/schemas.py`](app/modules/auth/schemas.py:22):
   - Add `business_license_url` and `factory_address` to `SupplierProfileCreate`
   - Add all new fields to `SupplierProfileResponse`

**3. Migration** — New Alembic revision `008`
   - `ALTER TABLE supplier_profiles ADD COLUMN business_license_url VARCHAR`
   - `ALTER TABLE supplier_profiles ADD COLUMN verification_status VARCHAR NOT NULL DEFAULT 'PENDING'`
   - `ALTER TABLE supplier_profiles ADD COLUMN factory_address TEXT`

**4. Service** [`app/modules/auth/service.py`](app/modules/auth/service.py:94) — `_create_user_profile`:
   - Pass new fields when creating `SupplierProfile`
