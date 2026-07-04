import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { dashboardPathForRole } from "@/constants/routes";

/**
 * Generic dashboard gateway (/dashboard).
 * Redirects to the role-scoped dashboard route (/agent, /client, or /admin).
 */
export function DashboardRouter() {
  const role = useAuthStore((s) => s.role);

  if (!role) {
    return <Navigate to="/auth/login" replace />;
  }

  return <Navigate to={dashboardPathForRole(role)} replace />;
}
