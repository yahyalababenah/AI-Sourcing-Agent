import { createBrowserRouter, Navigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { AdminLoginPage } from "@/pages/auth/AdminLoginPage";
import { sharedRoutes } from "./routeFactories";
import type { RouteObject } from "react-router-dom";

/**
 * Application route definitions — 3-tier RBAC with isolated layouts.
 *
 * Route architecture:
 *   /                 → redirect to /dashboard
 *   /auth/login       → LoginPage (public — tab toggle Client/Agent/Admin)
 *   /auth/register    → RegisterPage (public — Client/Agent only)
 *   /admin/login      → AdminLoginPage (public — dedicated admin portal)
 *
 *   ProtectedRoute (auth guard)
 *     └── AppLayout (role dispatcher → ClientLayout | AgentLayout | AdminLayout)
 *           ├── /dashboard          → Role-based dashboard component
 *           ├── /rfq/*              → RFQ pages (all roles)
 *           ├── /documents/*        → Documents (agent/admin only via RoleGuard)
 *           ├── /pricing/*          → Pricing (admin rules; agent/admin calculate)
 *           ├── /quotes/*           → Quotation pages (all roles)
 *           └── /settings           → Settings page (all roles)
 *
 *   *                 → redirect to /dashboard
 */
export const router = createBrowserRouter([
  // ── Root redirect ──
  {
    path: "/",
    element: <Navigate to={ROUTES.DASHBOARD} replace />,
  },

  // ── Public auth routes (no layout) ──
  {
    path: ROUTES.AUTH.LOGIN,
    element: <LoginPage />,
  },
  {
    path: ROUTES.AUTH.REGISTER,
    element: <RegisterPage />,
  },
  {
    path: ROUTES.ADMIN.LOGIN,
    element: <AdminLoginPage />,
  },

  // ── Protected routes (auth guard → role-based layout → role-scoped pages) ──
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          // All routes are defined in a single shared tree with RoleGuard wrappers.
          // AppLayout dispatches to ClientLayout/AgentLayout/AdminLayout which
          // renders <Outlet /> with the matched child route.
          ...sharedRoutes,
        ] as RouteObject[],
      },
    ],
  },

  // ── Catch-all: redirect unknown paths to dashboard ──
  {
    path: "*",
    element: <Navigate to={ROUTES.DASHBOARD} replace />,
  },
]);
