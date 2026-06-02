import { createBrowserRouter, Navigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
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
 * Application route definitions using React Router's createBrowserRouter.
 *
 * Route hierarchy:
 *   / → redirect to /dashboard
 *   /auth/login, /auth/register → standalone pages (no layout)
 *   ProtectedRoute (checks auth, renders Outlet)
 *     └── AppLayout (sidebar + topbar + Outlet)
 *           ├── /dashboard
 *           ├── /rfq, /rfq/create, /rfq/:id
 *           ├── /documents/upload, /documents/:id
 *           ├── /pricing/rules, /pricing/calculate
 *           ├── /quotes, /quotes/:id
 *           └── /settings
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
          {
            path: ROUTES.DASHBOARD,
            element: <DashboardPage />,
          },

          // RFQ Management (Phase 2)
          {
            path: ROUTES.RFQ.LIST,
            element: <RFQListPage />,
          },
          {
            path: ROUTES.RFQ.CREATE,
            element: <RFQCreatePage />,
          },
          {
            path: ROUTES.RFQ.DETAIL(":id"),
            element: <RFQDetailPage />,
          },

          // Document Management (Phase 3)
          {
            path: ROUTES.DOCUMENTS.UPLOAD,
            element: <DocumentUploadPage />,
          },
          {
            path: ROUTES.DOCUMENTS.DETAIL(":id"),
            element: <DocumentDetailPage />,
          },

          // Pricing (Phase 4)
          {
            path: ROUTES.PRICING.RULES,
            element: <PricingRulesPage />,
          },
          {
            path: ROUTES.PRICING.CALCULATE,
            element: <PricingCalcPage />,
          },

          // Quotations (Phase 5)
          {
            path: ROUTES.QUOTES.LIST,
            element: <QuotationListPage />,
          },
          {
            path: ROUTES.QUOTES.DETAIL(":id"),
            element: <QuotationDetailPage />,
          },

          // Settings
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
