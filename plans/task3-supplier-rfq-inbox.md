# Task 3: Supplier RFQ Inbox — Implementation Plan

## Plan Reference
- **Plan ID**: `ai-client-rfq-leaf3`
- **Label**: واجهة المورد للرد على طلبات التسعير (Supplier RFQ Inbox)
- **Description**: صفحة SupplierRfqInbox.tsx، GET /api/v1/intake/rfqs?supplier_id=me، بطاقات عرض المنتج والكمية والميناء مع زر "تقديم عرض سعر فوري"

## Architecture Overview

The "Supplier" in context is the **Agent** role — the person who responds to client RFQs with pricing quotations. The existing backend already supports agent-scoped RFQ listing (assigned + unassigned open RFQs). We need:

1. **Backend**: Add `supplier_id` query param alias for `GET /rfqs`
2. **Frontend Page**: New `SupplierRfqInbox.tsx` showing open RFQs as responsive cards
3. **Pricing Integration**: Link "تقديم عرض سعر فوري" button to pricing calculator with RFQ pre-selected via URL param

---

## Changes

### 1. Backend: `app/modules/intake/router.py`

**Change**: Add `supplier_id: Optional[str] = Query(None)` to `list_rfqs_endpoint`.

- When `supplier_id == "me"` and user is AGENT → pass `agent_id=user_id` to `list_rfqs()`
- This is an alias for the existing agent-scoped filtering — no new service logic needed.

```python
supplier_id: Optional[str] = Query(None, description="Filter by supplier (use 'me' for current agent)"),
```

Logic:
```python
if supplier_id == "me" and current_user.role == UserRole.AGENT:
    return await list_rfqs(db, pagination=pagination, agent_id=user_id, status=status)
```

### 2. Frontend: `frontend/src/pages/rfq/SupplierRfqInbox.tsx` (NEW)

A dedicated page for agents showing open RFQs in a card layout.

**Data Flow**:
- Fetch: `intakeService.list({ status: "open", limit: 50 })` on mount
- Also fetch products for each RFQ (or show extracted_entities summary)

**UI Layout**:
- Title: "صندوق وارد طلبات التسعير"
- Grid of cards (responsive: 1 col mobile, 2 col tablet, 3 col desktop)
- Each card shows:
  - **Client name** (client_name or "عميل")
  - **Product/Request** (client_request_arabic, truncated to 100 chars)
  - **Products table**: name, quantity extracted from RFQ products
  - **Port**: destination_port or "—"
  - **Date**: created_at formatted
  - **"تقديم عرض سعر فوري" button** → navigates to `/pricing/calculate?rfq_id=<id>`
- Loading skeleton / empty state

**States**:
- **Loading**: Skeleton cards (pulse animation)
- **Empty**: "لا توجد طلبات تسعير مفتوحة حالياً" with illustration
- **Error**: Error message with retry button
- **Data**: Grid of RFQ cards

### 3. Frontend: `frontend/src/pages/pricing/PricingCalcPage.tsx` (MODIFY)

**Change**: Read `rfq_id` from URL search params on mount.

```typescript
const [searchParams] = useSearchParams();
const rfqFromUrl = searchParams.get("rfq_id");
```

If `rfqFromUrl` is set, auto-select that RFQ in the dropdown (via `useEffect`).

Need to import `useSearchParams` from `react-router-dom`.

### 4. Frontend: `frontend/src/constants/routes.ts` (MODIFY)

Add:
```typescript
RFQ: {
    SUPPLIER_INBOX: "/rfq/supplier-inbox",
    // ... existing
}
```

### 5. Frontend: `frontend/src/router/routeFactories.tsx` (MODIFY)

Add route:
```typescript
{
    path: ROUTES.RFQ.SUPPLIER_INBOX,
    element: (
        <RoleGuard roles={["agent", "admin"]} redirectTo={ROUTES.DASHBOARD}>
            <SupplierRfqInbox />
        </RoleGuard>
    ),
}
```

### 6. Frontend: `frontend/src/components/layout/AgentSidebar.tsx` (MODIFY)

Add nav item:
```typescript
{ to: ROUTES.RFQ.SUPPLIER_INBOX, label: "صندوق المورد", icon: Inbox },
```

Import `Inbox` from `lucide-react`.

---

## Files Changed Summary

| File | Action |
|------|--------|
| `app/modules/intake/router.py` | MODIFY — add `supplier_id` query param |
| `frontend/src/pages/rfq/SupplierRfqInbox.tsx` | CREATE — new supplier inbox page |
| `frontend/src/pages/pricing/PricingCalcPage.tsx` | MODIFY — read `rfq_id` from URL params |
| `frontend/src/constants/routes.ts` | MODIFY — add `SUPPLIER_INBOX` route |
| `frontend/src/router/routeFactories.tsx` | MODIFY — add route entry |
| `frontend/src/components/layout/AgentSidebar.tsx` | MODIFY — add sidebar link |
| `plan-ai-sourcing-hub-2026.json` | MODIFY — mark `ai-client-rfq-leaf3` as active |
