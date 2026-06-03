import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { ROUTES } from "@/constants/routes";

/**
 * Route guard that redirects unauthenticated users to the appropriate login page.
 *
 * - Unauthenticated users on `/admin/*` paths are sent to `/admin/login`
 * - All other unauthenticated users go to `/auth/login`
 * - Preserves the intended URL in `state.from` for post-login redirect
 */
export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    const isAdminPath = location.pathname.startsWith("/admin");
    const loginPath = isAdminPath ? ROUTES.ADMIN.LOGIN : ROUTES.AUTH.LOGIN;
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  return <Outlet />;
}
