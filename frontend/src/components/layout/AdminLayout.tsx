import { Outlet } from "react-router-dom";
import { AdminSidebar } from "./AdminSidebar";
import { Topbar } from "./Topbar";
import { MobileTabBar } from "./MobileTabBar";
import { Toaster } from "react-hot-toast";

export function AdminLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50" style={{ background: "var(--app-bg)" }}>
      {/* Sidebar — desktop only */}
      <div className="hidden lg:flex">
        <AdminSidebar />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Bottom tab bar — mobile only */}
      <MobileTabBar />

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
