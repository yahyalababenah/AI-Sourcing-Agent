import { Outlet } from "react-router-dom";
import { AgentSidebar } from "./AgentSidebar";
import { Topbar } from "./Topbar";
import { Toaster } from "react-hot-toast";

/**
 * Agent Operations Layout — full workflow hub for procurement agents.
 *
 * Features:
 * - Agent-specific sidebar (RFQs, Documents, Pricing, Quotations)
 * - Topbar with user profile and notifications
 * - Content area for agent-facing pages
 */
export function AgentLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <div className="hidden lg:block">
        <AgentSidebar />
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
