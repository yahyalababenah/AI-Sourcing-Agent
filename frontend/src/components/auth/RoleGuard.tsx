import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import type { UserRole } from "@/types/auth";

interface RoleGuardProps {
  /** Allowed roles for this route. */
  roles: UserRole[];
  /** Content to render if authorized. */
  children: ReactNode;
  /** Optional fallback when unauthorized. */
  fallback?: ReactNode;
  /** Where to redirect if unauthorized. Defaults to /dashboard. */
  redirectTo?: string;
}

/**
 * Role-based access control wrapper.
 * Renders children only if the current user has one of the specified roles.
 */
export function RoleGuard({ roles, children, fallback, redirectTo = "/dashboard" }: RoleGuardProps) {
  const role = useAuthStore((s) => s.role);

  if (!role || !roles.includes(role)) {
    if (fallback) return <>{fallback}</>;
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
