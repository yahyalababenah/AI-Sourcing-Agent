import { Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { ClientSidebar } from "./ClientSidebar";
import { AgentSidebar } from "./AgentSidebar";
import { AdminSidebar } from "./AdminSidebar";
import { Topbar } from "./Topbar";
import { Toaster } from "react-hot-toast";
import type { UserRole } from "@/types/auth";

const sidebarMap: Record<UserRole, React.ComponentType> = {
  client: ClientSidebar,
  agent: AgentSidebar,
  admin: AdminSidebar,
};

/**
 * Main application layout with role-specific sidebar, topbar, and content area.
 * Wraps all authenticated pages.
 */
export function AppLayout() {
  const role = useAuthStore((s) => s.role);
  const SidebarComponent = role ? sidebarMap[role] : AgentSidebar;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <div className="hidden lg:block">
        <SidebarComponent />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      {/* Global toast notifications */}
      <Toaster
        position="top-left"
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: "Cairo, system-ui, sans-serif",
            direction: "rtl",
          },
        }}
      />
    </div>
  );
}
