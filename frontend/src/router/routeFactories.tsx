import { ROUTES } from "@/constants/routes";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { DashboardRouter } from "@/pages/dashboard/DashboardRouter";
import { MarketplacePage } from "@/pages/catalog/MarketplacePage";
import { SupplierShowroomPage } from "@/pages/catalog/SupplierShowroomPage";
import { SupplierProductsPage } from "@/pages/catalog/SupplierProductsPage";
import { ProductReviewPage } from "@/pages/catalog/ProductReviewPage";
import { RFQListPage } from "@/pages/rfq/RFQListPage";
import { RFQCreatePage } from "@/pages/rfq/RFQCreatePage";
import { RFQDetailPage } from "@/pages/rfq/RFQDetailPage";
import { SupplierRfqInbox } from "@/pages/rfq/SupplierRfqInbox";
import { QuoteBuilderPage } from "@/pages/rfq/QuoteBuilderPage";
import { DocumentUploadPage } from "@/pages/documents/DocumentUploadPage";
import { DocumentDetailPage } from "@/pages/documents/DocumentDetailPage";
import { PricingRulesPage } from "@/pages/pricing/PricingRulesPage";
import { PricingCalcPage } from "@/pages/pricing/PricingCalcPage";
import { QuotationListPage } from "@/pages/quotes/QuotationListPage";
import { QuotationDetailPage } from "@/pages/quotes/QuotationDetailPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { ProfilePage } from "@/pages/profile/ProfilePage";
import { OrderTrackingPage } from "@/pages/orders/OrderTrackingPage";
import { OrdersListPage } from "@/pages/orders/OrdersListPage";
import { AdminVerificationPage } from "@/pages/admin/AdminVerificationPage";
import { AdminMonitorPage } from "@/pages/admin/AdminMonitorPage";
import { AdminHSCodeSchedulesPage } from "@/pages/admin/AdminHSCodeSchedulesPage";
import { ChatRoomListPage } from "@/pages/chat/ChatRoomListPage";
import { ChatRoomDetailPage } from "@/pages/chat/ChatRoomDetailPage";
import type { RouteObject } from "react-router-dom";

/**
 * Shared application routes — single route tree with role-based guards.
 *
 * Layout isolation is handled by AppLayout → role-specific layout dispatch.
 * Page-level role guards provide fine-grained access control.
 */
export const sharedRoutes: RouteObject[] = [
  // ── Dashboard (role-switched via DashboardRouter) ──
  {
    path: ROUTES.DASHBOARD,
    element: <DashboardRouter />,
  },

  // ── Global Catalog Marketplace (client, agent & admin) ──
  {
    path: ROUTES.CATALOG.MARKETPLACE,
    element: (
      <RoleGuard roles={["client", "agent", "admin"]} redirectTo={ROUTES.DASHBOARD}>
        <MarketplacePage />
      </RoleGuard>
    ),
  },

  // ── Supplier Showroom (client, agent & admin) ──
  {
    path: ROUTES.CATALOG.SUPPLIER_SHOWROOM(":supplierId"),
    element: (
      <RoleGuard roles={["client", "agent", "admin"]} redirectTo={ROUTES.DASHBOARD}>
        <SupplierShowroomPage />
      </RoleGuard>
    ),
  },

  // ── Supplier: My Products (agent & admin) ──
  {
    path: ROUTES.SUPPLIER.MY_PRODUCTS,
    element: (
      <RoleGuard roles={["agent", "admin"]} redirectTo={ROUTES.DASHBOARD}>
        <SupplierProductsPage />
      </RoleGuard>
    ),
  },

  // ── Supplier: Product Review (agent & admin) ──
  {
    path: ROUTES.SUPPLIER.REVIEW,
    element: (
      <RoleGuard roles={["agent", "admin"]} redirectTo={ROUTES.DASHBOARD}>
        <ProductReviewPage />
      </RoleGuard>
    ),
  },

  // ── RFQ Management (all roles) ──
  {
    path: ROUTES.RFQ.LIST,
    element: <RFQListPage />,
  },
  {
    path: ROUTES.RFQ.CREATE,
    element: (
      <RoleGuard roles={["client", "agent", "admin"]} redirectTo={ROUTES.DASHBOARD}>
        <RFQCreatePage />
      </RoleGuard>
    ),
  },
  {
    path: ROUTES.RFQ.DETAIL(":id"),
    element: <RFQDetailPage />,
  },
  {
    path: ROUTES.RFQ.BUILD_QUOTE(":id"),
    element: (
      <RoleGuard roles={["agent", "admin"]} redirectTo={ROUTES.DASHBOARD}>
        <QuoteBuilderPage />
      </RoleGuard>
    ),
  },

  // ── Supplier RFQ Inbox (Agent/Admin only) ──
  {
    path: ROUTES.RFQ.SUPPLIER_INBOX,
    element: (
      <RoleGuard roles={["agent", "admin"]} redirectTo={ROUTES.DASHBOARD}>
        <SupplierRfqInbox />
      </RoleGuard>
    ),
  },

  // ── Document Management (Agent/Admin only) ──
  {
    path: ROUTES.DOCUMENTS.UPLOAD,
    element: (
      <RoleGuard roles={["agent", "admin"]} redirectTo={ROUTES.DASHBOARD}>
        <DocumentUploadPage />
      </RoleGuard>
    ),
  },
  {
    path: ROUTES.DOCUMENTS.DETAIL(":id"),
    element: (
      <RoleGuard roles={["agent", "admin"]} redirectTo={ROUTES.DASHBOARD}>
        <DocumentDetailPage />
      </RoleGuard>
    ),
  },

  // ── Pricing (Admin only for rules; Agent/Admin for calculate) ──
  {
    path: ROUTES.PRICING.RULES,
    element: (
      <RoleGuard roles={["admin"]} redirectTo={ROUTES.DASHBOARD}>
        <PricingRulesPage />
      </RoleGuard>
    ),
  },
  {
    path: ROUTES.PRICING.CALCULATE,
    element: (
      <RoleGuard roles={["agent", "admin"]} redirectTo={ROUTES.DASHBOARD}>
        <PricingCalcPage />
      </RoleGuard>
    ),
  },

  // ── Quotations (all roles) ──
  {
    path: ROUTES.QUOTES.LIST,
    element: <QuotationListPage />,
  },
  {
    path: ROUTES.QUOTES.DETAIL(":id"),
    element: <QuotationDetailPage />,
  },

  // ── Orders List (all roles) ──
  {
    path: ROUTES.ORDERS.LIST,
    element: <OrdersListPage />,
  },

  // ── Order Tracking (all roles — tracking page is role-aware) ──
  {
    path: ROUTES.ORDERS.TRACKING(":id"),
    element: <OrderTrackingPage />,
  },

  // ── Chat / Negotiation Rooms (all authenticated roles) ──
  {
    path: ROUTES.CHAT.LIST,
    element: <ChatRoomListPage />,
  },
  {
    path: ROUTES.CHAT.ROOM(":roomId"),
    element: <ChatRoomDetailPage />,
  },

  // ── Settings (all roles) ──
  {
    path: ROUTES.SETTINGS,
    element: <SettingsPage />,
  },

  // ── Profile (all authenticated roles) ──
  {
    path: ROUTES.PROFILE,
    element: <ProfilePage />,
  },

  // ── Admin: Supplier Verification (admin only) ──
  {
    path: ROUTES.ADMIN.VERIFICATION,
    element: (
      <RoleGuard roles={["admin"]} redirectTo={ROUTES.DASHBOARD}>
        <AdminVerificationPage />
      </RoleGuard>
    ),
  },

  // ── Admin: System Monitor (admin only) ──
  {
    path: ROUTES.ADMIN.MONITOR,
    element: (
      <RoleGuard roles={["admin"]} redirectTo={ROUTES.DASHBOARD}>
        <AdminMonitorPage />
      </RoleGuard>
    ),
  },

  // ── Admin: HS-Code Fee Schedules (admin only) ──
  {
    path: ROUTES.ADMIN.HS_CODES,
    element: (
      <RoleGuard roles={["admin"]} redirectTo={ROUTES.DASHBOARD}>
        <AdminHSCodeSchedulesPage />
      </RoleGuard>
    ),
  },
];
