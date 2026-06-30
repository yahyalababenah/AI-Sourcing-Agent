import { Outlet } from "react-router-dom";
import { AgentSidebar } from "./AgentSidebar";
import { Topbar } from "./Topbar";
import { Toaster } from "react-hot-toast";

export function AgentLayout() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--app-bg)" }}>
      <div className="hidden lg:block">
        <AgentSidebar />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
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
