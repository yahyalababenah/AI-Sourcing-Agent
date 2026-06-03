import { useAuthStore } from "@/stores/authStore";
import { ClientLayout } from "./ClientLayout";
import { AgentLayout } from "./AgentLayout";
import { AdminLayout } from "./AdminLayout";
import type { UserRole } from "@/types/auth";

/**
 * Layout dispatch map — selects the correct isolated layout based on role.
 */
const layoutMap: Record<UserRole, React.ComponentType> = {
  client: ClientLayout,
  agent: AgentLayout,
  admin: AdminLayout,
};

/**
 * Role-based application layout dispatcher.
 *
 * Delegates to the appropriate isolated layout (ClientLayout, AgentLayout,
 * or AdminLayout) based on the authenticated user's role. Each layout
 * is fully self-contained with its own sidebar, topbar, and toast system.
 *
 * This allows the router to maintain a single route tree while each role
 * experiences a completely different navigation UI.
 */
export function AppLayout() {
  const role = useAuthStore((s) => s.role);
  const LayoutComponent = role ? layoutMap[role] : AgentLayout;

  return <LayoutComponent />;
}
