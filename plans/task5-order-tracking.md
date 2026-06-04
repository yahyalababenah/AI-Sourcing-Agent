# Task 5: Order Tracking Pipeline ✅

## Overview
When a quotation is **ACCEPTED**, it becomes an "order" that needs tracking through 6 stages:
AWAITING_PAYMENT → PRODUCTION → INLAND_FREIGHT → SEA_FREIGHT → CUSTOMS → DELIVERED

**Status: COMPLETED** — All 4 leaves implemented, tested end-to-end.

## Leaf 1: Backend DB Schema ✅
- [x] Add `TrackingStatus` enum to `app/modules/output/models.py`
- [x] Add `tracking_status` (nullable) column to `Quotation` model
- [x] Create `TrackingEvent` model for status change history
- [x] Create Alembic migration `007`
- [x] Add tracking schemas, service functions, and endpoints
- [x] Forward-only pipeline validation (`_validate_tracking_transition`)

## Leaf 2: Client Order Tracking Timeline UI ✅
- [x] Create `frontend/src/types/orders.ts` — TypeScript types
- [x] Create `frontend/src/services/orderTrackingService.ts` — API service
- [x] Create `frontend/src/pages/orders/OrderTrackingPage.tsx` — Visual timeline
- [x] Arabic labels for all 6 pipeline stages
- [x] Timeline UI with colored dots, lines, status indicators
- [x] Event history (reverse chronological)

## Leaf 3: Agent/Supplier Status Update ✅
- [x] PUT endpoint for tracking status updates
- [x] Status update form in OrderTrackingPage (for agents/admins)
- [x] Quick action buttons to jump to future statuses
- [x] Notes/comment support on status updates
- [x] Role-based UI (agents/admins see controls, clients only see timeline)

## Leaf 4: Notifications ✅
- [x] Sidebar nav links in AgentSidebar, ClientSidebar, AdminSidebar
- [x] Auto-refresh via React Query polling (30s interval)
- [x] "🚚 تتبع" button in QuotationListPage for accepted quotations
- [x] "🚚 تتبع الشحنة" button + tracking_status badge in QuotationDetailPage

## Files Modified/Created
1. `app/modules/output/models.py` — Add TrackingStatus enum + TrackingEvent model
2. `alembic/versions/007_add_tracking_status.py` — New migration
3. `app/modules/output/schemas.py` — Add tracking schemas
4. `app/modules/output/service.py` — Add tracking service functions (+ `from __future__ import annotations` fix)
5. `app/modules/output/router.py` — Add tracking endpoints
6. `frontend/src/types/orders.ts` — NEW: TypeScript types
7. `frontend/src/services/orderTrackingService.ts` — NEW: API service
8. `frontend/src/pages/orders/OrderTrackingPage.tsx` — NEW: Timeline page
9. `frontend/src/router/routeFactories.tsx` — Add route
10. `frontend/src/components/layout/AgentSidebar.tsx` — Add nav link
11. `frontend/src/components/layout/ClientSidebar.tsx` — Add nav link
12. `frontend/src/components/layout/AdminSidebar.tsx` — Add nav link
13. `frontend/src/pages/quotes/QuotationListPage.tsx` — Add tracking column + button
14. `frontend/src/pages/quotes/QuotationDetailPage.tsx` — Add tracking badge + button
15. `frontend/src/constants/routes.ts` — Add ORDERS route
16. `frontend/src/constants/api.ts` — Add TRACKING endpoint
17. `plan-ai-sourcing-hub-2026.json` — Update status to completed
