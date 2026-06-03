import { createBrowserRouter, Navigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { DashboardRouter } from "@/pages/dashboard/DashboardRouter";
import { RFQListPage } from "@/pages/rfq/RFQListPage";
import { RFQCreatePage } from "@/pages/rfq/RFQCreatePage";
import { RFQDetailPage } from "@/pages/rfq/RFQDetailPage";
import { DocumentUploadPage } from "@/pages/documents/DocumentUploadPage";
import { DocumentDetailPage } from "@/pages/documents/DocumentDetailPage";
import { PricingRulesPage } from "@/pages/pricing/PricingRulesPage";
import { PricingCalcPage } from "@/pages/pricing/PricingCalcPage";
import { QuotationListPage } from "@/pages/quotes/QuotationListPage";
import { QuotationDetailPage } from "@/pages/quotes/QuotationDetailPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";

/**
 * Application route definitions — 3-tier RBAC routing.
 *
 * Route hierarchy:
 *   / → redirect to /dashboard
 *   /auth/login, /auth/register → standalone (no layout)
 *   ProtectedRoute (checks auth)
 *     └── AppLayout (role-based sidebar + Topbar + Outlet)
 *           ├── /dashboard → DashboardRouter (role-based dashboard)
 *           ├── /rfq        → RFQListPage (agent/admin) | RFQListPage (client, own only)
 *           ├── /rfq/create → RoleGuard [agent,admin] | RFQCreatePage
 *           ├── /rfq/:id    → RFQDetailPage
 *           ├── /documents/upload → RoleGuard [agent,admin] | DocumentUploadPage
 *           ├── /documents/:id    → RoleGuard [agent,admin] | DocumentDetailPage
 *           ├── /pricing/rules    → RoleGuard [admin] | PricingRulesPage
 *           ├── /pricing/calculate → RoleGuard [agent,admin] | PricingCalcPage
 *           ├── /quotes     → QuotationListPage
 *           ├── /quotes/:id → QuotationDetailPage
 *           └── /settings   → SettingsPage
 *   * → redirect to /dashboard
 */
export const router = createBrowserRouter([
  // ── Root redirect ──
  {
    path: "/",
    element: <Navigate to={ROUTES.DASHBOARD} replace />,
  },

  // ── Public auth routes (no sidebar layout) ──
  {
    path: ROUTES.AUTH.LOGIN,
    element: <LoginPage />,
  },
  {
    path: ROUTES.AUTH.REGISTER,
    element: <RegisterPage />,
  },

  // ── Protected routes (require authentication + AppLayout) ──
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          // ── Role-based Dashboard ──
          {
            path: ROUTES.DASHBOARD,
            element: <DashboardRouter />,
          },

          // ── RFQ Management ──
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

          // ── Quotations ──
          {
            path: ROUTES.QUOTES.LIST,
            element: <QuotationListPage />,
          },
          {
            path: ROUTES.QUOTES.DETAIL(":id"),
            element: <QuotationDetailPage />,
          },

          // ── Settings ──
          {
            path: ROUTES.SETTINGS,
            element: <SettingsPage />,
          },
        ],
      },
    ],
  },

  // ── Catch-all: redirect unknown paths to dashboard ──
  {
    path: "*",
    element: <Navigate to={ROUTES.DASHBOARD} replace />,
  },
]);
