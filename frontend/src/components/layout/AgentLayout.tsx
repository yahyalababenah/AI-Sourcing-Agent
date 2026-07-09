import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { MobileDrawer } from "./MobileDrawer";
import { Toaster } from "react-hot-toast";
import { OnboardingProvider } from "@/components/onboarding/OnboardingProvider";

export function AgentLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <div className="hidden lg:flex">
        <Sidebar role="agent" />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:p-6 lg:pb-6">
          <Outlet />
        </main>
      </div>

      <MobileDrawer role="agent" />
      <BottomNav role="agent" />
      <OnboardingProvider role="agent" />

      <Toaster
        position="top-left"
        toastOptions={{
          duration: 4000,
          style: { fontFamily: "Cairo, system-ui, sans-serif", direction: "rtl" },
        }}
      />
    </div>
  );
}
