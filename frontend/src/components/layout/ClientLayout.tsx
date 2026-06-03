import { Outlet } from "react-router-dom";
import { ClientSidebar } from "./ClientSidebar";
import { Topbar } from "./Topbar";
import { Toaster } from "react-hot-toast";

/**
 * Client Portal Layout — minimalistic e-commerce-style dashboard.
 *
 * Features:
 * - Client-specific sidebar (RFQ management, quotes, settings)
 * - Topbar with user profile and notifications
 * - Content area for client-facing pages
 */
export function ClientLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <div className="hidden lg:block">
        <ClientSidebar />
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
