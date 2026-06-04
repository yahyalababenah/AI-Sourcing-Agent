# Task 4: Database Indexes & CatalogProduct Model

## Plan Reference
- **Plan ID**: `ai-client-search-leaf1`
- **Label**: هندسة قاعدة البيانات وفهارس البحث (Database Indexes)
- **Description**: إنشاء B-Tree Indexes على price/category_id و GIN Index على title/description لدعم Full-Text Search في PostgreSQL

## Current State
Products are stored as JSONB in `Document.extracted_entities['products']`. The `search_catalog()` function reads ALL documents into memory and does Python-side filtering — extremely inefficient at scale.

## Implementation Plan

### 1. `app/modules/catalog/models.py` (NEW)
Create `CatalogProduct` SQLAlchemy model:

**Columns**:
| Column | Type | Index | Notes |
|--------|------|-------|-------|
| id | UUID PK | Primary | Auto-generated |
| document_id | UUID FK→documents | B-Tree | Source document |
| supplier_id | UUID FK→users | B-Tree | Supplier (agent) |
| product_name | String(500) | — | Search target |
| model_number | String(200) | — | Search target |
| unit_price_rmb | Float | **B-Tree** | For min/max price range queries |
| moq | Integer | — | Minimum order qty |
| weight_kg | Float | — | Weight |
| dimensions | String(200) | — | Dimensions |
| material | String(200) | — | Material (category fallback) |
| category | String(200) | **B-Tree** | For category filtering |
| search_vector | TSVector | **GIN** | PostgreSQL full-text search vector |
| created_at | DateTime | — | Auto |
| updated_at | DateTime | — | Auto |

**Indexes**:
- `ix_catalog_products_price` — B-Tree on `unit_price_rmb`
- `ix_catalog_products_category` — B-Tree on `category`
- `ix_catalog_products_search` — GIN on `search_vector`
- `ix_catalog_products_supplier` — B-Tree on `supplier_id`

**Trigger**: Auto-update `search_vector` from `product_name || ' ' || model_number || ' ' || material || ' ' || category` using `to_tsvector('simple', ...)`.

### 2. `alembic/versions/006_add_catalog_products.py` (NEW)
Alembic migration revision 006, depends on 005.

### 3. `app/modules/catalog/service.py` (REWRITE `search_catalog`)
Replace in-memory filtering with SQL-level querying:
- `ILIKE` for search term on `product_name` / `model_number`
- `tsquery` for full-text search via GIN index
- `>=`, `<=` for price range (uses B-Tree index)
- `=` for category match (uses B-Tree index)
- `=` for supplier_id (uses B-Tree index)
- Pagination at DB level (OFFSET/LIMIT)
- Join with User/SupplierProfile for supplier info

### 4. `app/modules/documents/service.py` (MODIFY)
After document status changes to EXTRACTED, sync products to `CatalogProduct`:
- Delete existing products for that document_id
- Insert new products from `extracted_entities['products']`
- Or add a separate sync function called from the extraction flow

### 5. `scripts/backfill_catalog_products.py` (NEW)
One-time script to backfill existing documents into catalog_products table.

## Files Changed

| File | Action |
|------|--------|
| `app/modules/catalog/models.py` | CREATE — CatalogProduct model |
| `app/modules/catalog/__init__.py` | MODIFY — import models |
| `alembic/versions/006_add_catalog_products.py` | CREATE — migration |
| `app/modules/catalog/service.py` | MODIFY — rewrite search_catalog |
| `app/modules/documents/service.py` | MODIFY — add sync after extraction |
| `scripts/backfill_catalog_products.py` | CREATE — backfill script |
| `plan-ai-sourcing-hub-2026.json` | MODIFY — mark leaf1 active |
| `plans/task4-catalog-database-indexes.md` | CREATE — this plan |
