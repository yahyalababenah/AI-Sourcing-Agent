import { useTranslation } from "react-i18next";
import { LogOut } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "./Sidebar";
import type { UserRole } from "@/types/auth";

interface MobileDrawerProps {
  role: UserRole;
}

/**
 * Mobile-only nav drawer — opens from the right (RTL) via the ☰ button in TopBar.
 * Mirrors the full desktop Sidebar content, per CLAUDE.md's mandatory mobile pattern.
 */
export function MobileDrawer({ role }: MobileDrawerProps) {
  const { t } = useTranslation();
  const { drawerOpen, closeDrawer } = useUIStore();
  const { logout } = useAuth();

  if (!drawerOpen) return null;

  return (
    <>
      <div
        onClick={closeDrawer}
        className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden"
        aria-hidden
      />
      <div
        className="fixed top-0 end-0 bottom-0 w-[270px] z-50 flex flex-col bg-white shadow-xl lg:hidden"
        dir="rtl"
      >
        <div className="flex-1 overflow-hidden">
          <Sidebar role={role} bare />
        </div>
        <button
          onClick={() => { closeDrawer(); logout(); }}
          className="flex items-center gap-2.5 px-4 py-3 text-[13px] font-medium text-red-600 border-t border-slate-100"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>{t("nav.logout")}</span>
        </button>
      </div>
    </>
  );
}
