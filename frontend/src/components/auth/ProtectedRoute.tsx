import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { authService } from "@/services/authService";
import { ROUTES } from "@/constants/routes";

/**
 * Route guard that redirects unauthenticated users to the appropriate login page.
 *
 * - Unauthenticated users on `/admin/*` paths are sent to `/admin/login`
 * - All other unauthenticated users go to `/auth/login`
 * - Preserves the intended URL in `state.from` for post-login redirect
 *
 * Also rehydrates `user`/`role` from `/auth/me` on a fresh page load when a
 * valid access token already exists in localStorage but the Zustand store
 * (in-memory only for `user`/`role`) hasn't been populated yet — e.g. after
 * a hard refresh or opening a link in a new tab. Without this, every
 * `RoleGuard`-protected route (quote builder, product review, supplier
 * inbox, ...) and `DashboardRouter` itself see `role === null` and silently
 * bounce back to the login page even though the session is still valid.
 */
export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);
  const setUser = useAuthStore((s) => s.setUser);
  const clearAuth = useAuthStore((s) => s.logout);
  const location = useLocation();
  const [bootstrapping, setBootstrapping] = useState(isAuthenticated && !role);

  useEffect(() => {
    if (!isAuthenticated || role) return;
    let cancelled = false;
    authService
      .getMe()
      .then((me) => {
        // Setting both in the same tick matters: setUser() changes `role`,
        // which is an effect dependency — React re-runs this effect (and
        // fires this closure's cleanup, flipping `cancelled` to true)
        // before a separate .finally() callback would get a chance to run,
        // permanently stalling the bootstrapping spinner. Bundling the two
        // updates here means they commit in the same render.
        if (!cancelled) {
          setUser(me);
          setBootstrapping(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearAuth();
          setBootstrapping(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, role]);

  if (!isAuthenticated) {
    const isAdminPath = location.pathname.startsWith("/admin");
    const loginPath = isAdminPath ? ROUTES.ADMIN.LOGIN : ROUTES.AUTH.LOGIN;
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (bootstrapping) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  return <Outlet />;
}
