# Task 2: Filters Sidebar + Catalog Query Parameters

## Goal

Implement the Filters Sidebar UI in `MarketplacePage.tsx` and add query parameters (`category`, `min_price`, `max_price`, `supplier_id`) to `catalog/router.py` and `catalog/service.py`.

This corresponds to two plan leaves being completed together:
- [`ai-client-search-leaf2`](/plan-ai-sourcing-hub-2026.json:52) — FastAPI query interface (currently has only `q`)
- [`ai-client-search-leaf4`](/plan-ai-sourcing-hub-2026.json:76) — Filters Sidebar UI

---

## Current Architecture

### Backend ([`app/modules/catalog/`](/app/modules/catalog/))

- **No dedicated `CatalogProduct` DB table.** Products are stored as JSON arrays inside [`Document.extracted_entities`](/app/modules/documents/models.py:63) (JSONB column).
- [`search_catalog()`](/app/modules/catalog/service.py:29) fetches ALL `Document` rows with `status=EXTRACTED`, flattens their `extracted_entities["products"]` into Python dicts, filters by `q` in Python, then paginates.
- [`CatalogProductResponse`](/app/modules/catalog/schemas.py:10) has NO `category` field. Filterable numeric fields: `unit_price_rmb`. Filterable UUID field: `supplier_id`.

### Frontend ([`frontend/src/pages/catalog/MarketplacePage.tsx`](/frontend/src/pages/catalog/MarketplacePage.tsx))

- Single search bar with 300ms debounce.
- Product grid: 4-col responsive layout.
- Pagination at bottom.
- RFQ modal on product selection.
- **No filter sidebar or category/price/supplier controls.**

---

## Implementation Plan

### Step A: Update Plan File Status

Before coding, update [`plan-ai-sourcing-hub-2026.json`](/plan-ai-sourcing-hub-2026.json) to mark all completed tasks:

1. Set `"status": "completed"` for 18 confirmed-done leaves (see analysis below).
2. Set `"status": "active"` for [`ai-supplier-auth-leaf2`](/plan-ai-sourcing-hub-2026.json:326) (partially done).
3. Update `"updatedAt"` timestamp.
4. Leave [`ai-client-search-leaf2`](/plan-ai-sourcing-hub-2026.json:52) as `"pending"` (will be completed by this task).

**Completed leaves to mark:**

| Leaf ID | Name |
|---------|------|
| `ai-client-search-leaf3` | Search bar + debounce |
| `ai-client-rfq-leaf1` | Send RFQ Modal |
| `ai-client-rfq-leaf2` | Scope & Create RFQ |
| `ai-client-rfq-leaf4` | Submit Instant Quote |
| `ai-client-rfq-leaf5` | Client View & Accept Quote |
| `ai-client-customs-leaf1` | Customs Rules Schema |
| `ai-client-customs-leaf2` | Landed Cost Core Logic |
| `ai-client-customs-leaf3` | Admin Manage Customs UI |
| `ai-client-customs-leaf4` | Pricing Breakdown UI |
| `ai-supplier-auth-leaf1` | Registration Form |
| `ai-supplier-auth-leaf3` | Document Upload to MinIO |
| `ai-supplier-pdf-leaf1` | Catalog Upload Zone |
| `ai-supplier-pdf-leaf2` | File Upload Endpoint |
| `ai-supplier-pdf-leaf3` | AI Vision & Prompt Engineering |
| `ai-core-ocr-repair-leaf1` | Raw Text Extraction & Cleaning |
| `ai-core-ocr-repair-leaf2` | JSON Repair Engine |
| `ai-core-ocr-repair-leaf3` | Pydantic Schema Validation |
| `ai-core-ocr-repair-leaf4` | Bulk Database Seeding |

---

### Step B: Backend — Add Query Parameters

#### B1. [`app/modules/catalog/schemas.py`](/app/modules/catalog/schemas.py)

Add a new field to `CatalogProductResponse`:

```python
category: Optional[str] = Field(None, description="Product category derived from AI extraction or material")
```

This is `None` by default since existing extracted entities won't have it — it's forward-looking.

#### B2. [`app/modules/catalog/service.py`](/app/modules/catalog/service.py)

Extend `search_catalog()` signature to accept new parameters:

```python
async def search_catalog(
    db: AsyncSession,
    *,
    q: Optional[str] = None,
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    supplier_id: Optional[uuid.UUID] = None,
    page: int = 1,
    page_size: int = 20,
) -> CatalogListResponse:
```

Add Python-side filter logic after the existing `q` filter (line ~120):

```python
# ── 3b. Filter by supplier_id ──
if supplier_id is not None:
    all_products = [p for p in all_products if p["supplier_id"] == supplier_id]

# ── 3c. Filter by price range ──
if min_price is not None:
    all_products = [p for p in all_products if (p["unit_price_rmb"] is not None and p["unit_price_rmb"] >= min_price)]
if max_price is not None:
    all_products = [p for p in all_products if (p["unit_price_rmb"] is not None and p["unit_price_rmb"] <= max_price)]

# ── 3d. Filter by category ──
if category:
    cat_lower = category.strip().lower()
    all_products = [
        p for p in all_products
        if (p.get("category") and cat_lower in p["category"].lower())
        or (p.get("material") and cat_lower in p["material"].lower())
    ]
```

**Note:** Category filtering falls back to `material` field since `category` isn't in extracted data yet.

#### B3. [`app/modules/catalog/router.py`](/app/modules/catalog/router.py)

Add new query parameters to the endpoint:

```python
@router.get("/products", ...)
async def list_catalog_products(
    q: str = Query(None, min_length=1, max_length=200),
    category: str = Query(None, min_length=1, max_length=100, description="Filter by product category or material"),
    min_price: float = Query(None, ge=0, description="Minimum price in RMB"),
    max_price: float = Query(None, ge=0, description="Maximum price in RMB"),
    supplier_id: UUID = Query(None, description="Filter by supplier UUID"),
    pagination: PaginationParams = Depends(),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_client_or_admin),
):
    return await search_catalog(
        db,
        q=q,
        category=category,
        min_price=min_price,
        max_price=max_price,
        supplier_id=supplier_id,
        page=pagination.page,
        page_size=pagination.page_size,
    )
```

Add the `UUID` import:
```python
from uuid import UUID
```

---

### Step C: Frontend — Filters Sidebar

#### C1. [`frontend/src/types/catalog.ts`](/frontend/src/types/catalog.ts)

Add optional `category` field to `CatalogProduct`:

```typescript
export interface CatalogProduct {
  // ... existing fields ...
  category?: string | null;
  // ... rest unchanged ...
}
```

#### C2. [`frontend/src/services/catalogService.ts`](/frontend/src/services/catalogService.ts)

Extend `search()` params type:

```typescript
export const catalogService = {
  search: (params?: {
    q?: string;
    category?: string;
    min_price?: number;
    max_price?: number;
    supplier_id?: string;
    page?: number;
    page_size?: number;
  }) => api.get<CatalogListResponse>(API.CATALOG.PRODUCTS, { params }).then((r) => r.data),
};
```

#### C3. New file: [`frontend/src/pages/catalog/CatalogFilters.tsx`](/frontend/src/pages/catalog/CatalogFilters.tsx)

Create a new filter sidebar component:

```typescript
interface CatalogFiltersProps {
  /** Unique suppliers for the dropdown (derived from current data) */
  suppliers: Array<{ id: string; name: string }>;
  /** Unique categories (derived from current data) */
  categories: string[];
  /** Current filter values */
  filters: FilterState;
  /** Called when any filter changes */
  onChange: (filters: FilterState) => void;
  /** Reset all filters */
  onReset: () => void;
  /** Show/hide sidebar (mobile) */
  isOpen: boolean;
  onToggle: () => void;
}

export interface FilterState {
  category: string;
  minPrice: string;   // string for input control, parsed on send
  maxPrice: string;
  supplierId: string;
}
```

**Component structure (Arabic RTL):**

```
┌─ Filters Sidebar ─────────────────────┐
│                                        │
│  [✕] إغلاق الفلاتر          (mobile)   │
│                                        │
│  ─── الفئة ───                         │
│  [Dropdown] جميع الفئات                 │
│    ├── بلاستيك                         │
│    ├── معادن                           │
│    └── إلكترونيات                      │
│                                        │
│  ─── السعر (RMB) ───                   │
│  [Min]  [—]  [Max]                     │
│  (two number inputs side by side)      │
│                                        │
│  ─── المورد ───                        │
│  [Dropdown] جميع الموردين               │
│    ├── Supplier A                      │
│    └── Supplier B                      │
│                                        │
│  [إعادة تعيين]  [تطبيق الفلاتر]         │
└────────────────────────────────────────┘
```

**Deriving filter options from data:**
- Extract unique suppliers from the current `data.items` array inside `MarketplacePage`.
- Extract unique categories from `data.items` (using `product.category` or `product.material`).
- Pass these as props to `CatalogFilters`.

#### C4. Modify [`frontend/src/pages/catalog/MarketplacePage.tsx`](/frontend/src/pages/catalog/MarketplacePage.tsx)

**State additions:**

```typescript
// Filter state
const [filters, setFilters] = useState<FilterState>({
  category: "",
  minPrice: "",
  maxPrice: "",
  supplierId: "",
});
const [sidebarOpen, setSidebarOpen] = useState(false);
```

**Derive suppliers & categories from data:**

```typescript
// After data is loaded
const uniqueSuppliers = useMemo(() => {
  if (!data?.items) return [];
  const map = new Map<string, string>();
  data.items.forEach((p) => map.set(p.supplier_id, p.supplier_name));
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
}, [data]);

const uniqueCategories = useMemo(() => {
  if (!data?.items) return [];
  const cats = new Set<string>();
  data.items.forEach((p) => {
    if (p.category) cats.add(p.category);
    if (p.material) cats.add(p.material);
  });
  return Array.from(cats).sort();
}, [data]);
```

**Update query key and params:**

```typescript
const queryKey = [
  "catalog", "products", debouncedQuery,
  filters.category, filters.minPrice, filters.maxPrice,
  filters.supplierId, page, pageSize,
];

const queryFn = () => catalogService.search({
  q: debouncedQuery || undefined,
  category: filters.category || undefined,
  min_price: filters.minPrice ? Number(filters.minPrice) : undefined,
  max_price: filters.maxPrice ? Number(filters.maxPrice) : undefined,
  supplier_id: filters.supplierId || undefined,
  page,
  page_size: pageSize,
});
```

**Reset page when filters change — add a `useEffect`:**

```typescript
useEffect(() => {
  setPage(1);
}, [filters]);
```

**Layout change:** Wrap the search bar + content in a flex container:

```tsx
<div className="flex gap-6">
  {/* Filters Sidebar */}
  <CatalogFilters
    suppliers={uniqueSuppliers}
    categories={uniqueCategories}
    filters={filters}
    onChange={setFilters}
    onReset={() => setFilters({ category: "", minPrice: "", maxPrice: "", supplierId: "" })}
    isOpen={sidebarOpen}
    onToggle={() => setSidebarOpen(!sidebarOpen)}
  />

  {/* Main Content */}
  <div className="flex-1 min-w-0 space-y-6">
    {/* existing search bar + grid + pagination */}
  </div>
</div>
```

**Mobile responsiveness:**
- On `lg` screens: sidebar is always visible (w-64).
- Below `lg`: sidebar is a slide-over overlay (like the RFQ modal).
- Toggle button visible only on mobile.

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Python-side filtering (not DB query)** | Products are stored as JSON in `extracted_entities`, not as a relational table. Full DB query refactor would require a new `CatalogProduct` table + Alembic migration — outside this task scope. |
| **Category falls back to `material`** | No `category` field exists in AI-extracted data yet. Using `material` as proxy. Future task: add `category` to AI prompt templates. |
| **Filters derived client-side from data** | Avoids new backend endpoint. For a small catalog (<1000 products), this is efficient. |
| **Two number inputs instead of slider** | Simpler to implement, more precise, works on all devices. A dual-range slider can be added later. |
| **Sidebar on right (RTL)** | Arabic-first UI: sidebar should appear on the right side for natural RTL flow. |

---

## Files to Modify

| File | Change |
|------|--------|
| [`plan-ai-sourcing-hub-2026.json`](/plan-ai-sourcing-hub-2026.json) | Mark 18 leaves `completed`, 1 leaf `active`, update timestamp |
| [`app/modules/catalog/schemas.py`](/app/modules/catalog/schemas.py) | Add `category: Optional[str]` to `CatalogProductResponse` |
| [`app/modules/catalog/service.py`](/app/modules/catalog/service.py) | Extend `search_catalog()` with `category`, `min_price`, `max_price`, `supplier_id` + filtering logic |
| [`app/modules/catalog/router.py`](/app/modules/catalog/router.py) | Add 4 new `Query()` params, pass to service |
| [`frontend/src/types/catalog.ts`](/frontend/src/types/catalog.ts) | Add optional `category` to `CatalogProduct` |
| [`frontend/src/services/catalogService.ts`](/frontend/src/services/catalogService.ts) | Extend `search()` params type |
| [`frontend/src/pages/catalog/CatalogFilters.tsx`](/frontend/src/pages/catalog/CatalogFilters.tsx) | **NEW** — Filters sidebar component |
| [`frontend/src/pages/catalog/MarketplacePage.tsx`](/frontend/src/pages/catalog/MarketplacePage.tsx) | Add filter state, derive options from data, integrate sidebar, update query key/params |

---

## Execution Order

1. Update [`plan-ai-sourcing-hub-2026.json`](/plan-ai-sourcing-hub-2026.json) — mark completed tasks
2. [`app/modules/catalog/schemas.py`](/app/modules/catalog/schemas.py) — add `category` field
3. [`app/modules/catalog/service.py`](/app/modules/catalog/service.py) — add filter params + logic
4. [`app/modules/catalog/router.py`](/app/modules/catalog/router.py) — add query params
5. [`frontend/src/types/catalog.ts`](/frontend/src/types/catalog.ts) — add `category` type
6. [`frontend/src/services/catalogService.ts`](/frontend/src/services/catalogService.ts) — extend params
7. [`frontend/src/pages/catalog/CatalogFilters.tsx`](/frontend/src/pages/catalog/CatalogFilters.tsx) — create new component
8. [`frontend/src/pages/catalog/MarketplacePage.tsx`](/frontend/src/pages/catalog/MarketplacePage.tsx) — integrate filters sidebar
