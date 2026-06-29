import { Outlet } from "react-router-dom";
import { AdminSidebar } from "./AdminSidebar";
import { Topbar } from "./Topbar";
import { Toaster } from "react-hot-toast";

/**
 * Admin Dashboard Layout — monitoring, analytics, and system control.
 *
 * Features:
 * - Admin-specific sidebar (monitoring, pricing rules, user management)
 * - Topbar with user profile and notifications
 * - Content area for admin-facing pages
 */
export function AdminLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <div className="hidden lg:block">
        <AdminSidebar />
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
