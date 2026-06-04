import { ROUTES } from "@/constants/routes";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { DashboardRouter } from "@/pages/dashboard/DashboardRouter";
import { MarketplacePage } from "@/pages/catalog/MarketplacePage";
import { RFQListPage } from "@/pages/rfq/RFQListPage";
import { RFQCreatePage } from "@/pages/rfq/RFQCreatePage";
import { RFQDetailPage } from "@/pages/rfq/RFQDetailPage";
import { SupplierRfqInbox } from "@/pages/rfq/SupplierRfqInbox";
import { DocumentUploadPage } from "@/pages/documents/DocumentUploadPage";
import { DocumentDetailPage } from "@/pages/documents/DocumentDetailPage";
import { PricingRulesPage } from "@/pages/pricing/PricingRulesPage";
import { PricingCalcPage } from "@/pages/pricing/PricingCalcPage";
import { QuotationListPage } from "@/pages/quotes/QuotationListPage";
import { QuotationDetailPage } from "@/pages/quotes/QuotationDetailPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { OrderTrackingPage } from "@/pages/orders/OrderTrackingPage";
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

  // ── Global Catalog Marketplace (client & admin) ──
  {
    path: ROUTES.CATALOG.MARKETPLACE,
    element: (
      <RoleGuard roles={["client", "admin"]} redirectTo={ROUTES.DASHBOARD}>
        <MarketplacePage />
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
      <RoleGuard roles={["agent", "admin"]} redirectTo={ROUTES.DASHBOARD}>
        <RFQCreatePage />
      </RoleGuard>
    ),
  },
  {
    path: ROUTES.RFQ.DETAIL(":id"),
    element: <RFQDetailPage />,
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

  // ── Order Tracking (all roles — tracking page is role-aware) ──
  {
    path: ROUTES.ORDERS.TRACKING(":id"),
    element: <OrderTrackingPage />,
  },

  // ── Settings (all roles) ──
  {
    path: ROUTES.SETTINGS,
    element: <SettingsPage />,
  },
];
