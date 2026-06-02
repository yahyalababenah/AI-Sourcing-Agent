import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { ROUTES } from "@/constants/routes";

interface RoleGuardProps {
  /** Allowed roles for this route. */
  roles: Array<"agent" | "admin">;
  /** Content to render if authorized. */
  children: ReactNode;
  /** Optional fallback when unauthorized. */
  fallback?: ReactNode;
}

/**
 * Role-based access control wrapper.
 * Renders children only if the current user has one of the specified roles.
 */
export function RoleGuard({ roles, children, fallback }: RoleGuardProps) {
  const role = useAuthStore((s) => s.role);

  if (!role || !roles.includes(role)) {
    if (fallback) return <>{fallback}</>;
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <>{children}</>;
}
