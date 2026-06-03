import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { ClientDashboard } from "./ClientDashboard";
import { AgentDashboard } from "./AgentDashboard";
import { AdminDashboard } from "./AdminDashboard";
import type { UserRole } from "@/types/auth";

const dashboardMap: Record<UserRole, React.ComponentType> = {
  client: ClientDashboard,
  agent: AgentDashboard,
  admin: AdminDashboard,
};

/**
 * Role-based dashboard router.
 * Renders the appropriate dashboard component based on the current user's role.
 */
export function DashboardRouter() {
  const role = useAuthStore((s) => s.role);

  if (!role) {
    return <Navigate to="/auth/login" replace />;
  }

  const DashboardComponent = dashboardMap[role];
  return <DashboardComponent />;
}
