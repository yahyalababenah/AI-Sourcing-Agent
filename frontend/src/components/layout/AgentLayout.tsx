import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AgentSidebar } from "./AgentSidebar";
import { Topbar } from "./Topbar";
import { MobileDrawer } from "./MobileDrawer";
import { Toaster } from "react-hot-toast";

export function AgentLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--app-bg)" }}>
      {/* Sidebar — desktop only */}
      <div className="hidden lg:block">
        <AgentSidebar />
      </div>

      {/* Sidebar — mobile drawer */}
      <MobileDrawer isOpen={mobileOpen} onClose={() => setMobileOpen(false)}>
        <AgentSidebar />
      </MobileDrawer>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onMenuOpen={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      <Toaster
        position="top-left"
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif",
            direction: "rtl",
          },
        }}
      />
    </div>
  );
}
