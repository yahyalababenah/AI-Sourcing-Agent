import { useTranslation } from "react-i18next";
import { LogOut, X } from "lucide-react";
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

  return (
    <>
      <div
        onClick={closeDrawer}
        aria-hidden
        className={`fixed inset-0 bg-slate-900/40 z-40 lg:hidden transition-opacity duration-200 ${
          drawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <div
        dir="rtl"
        aria-hidden={!drawerOpen}
        // bottom sits above the guided tour's mobile TourBottomSheet (which
        // publishes --tour-sheet-height while mounted, see TourBottomSheet.tsx)
        // instead of the sheet just being layered on top of the drawer's
        // lower nav items and footer (profile/settings/logout) — those live
        // outside the nav's own scroll box, so a fixed overlay covering them
        // would make them unreachable, not just visually obscured.
        className={`fixed top-0 start-0 bottom-[var(--tour-sheet-height,0px)] w-[270px] z-50 flex flex-col bg-white shadow-xl lg:hidden transition-[transform,bottom] duration-200 ease-out ${
          drawerOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
      >
        <button
          onClick={closeDrawer}
          aria-label={t("common.close")}
          className="absolute top-1 end-1 z-10 flex h-11 w-11 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors duration-150 active:scale-[0.98]"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex-1 overflow-hidden">
          <Sidebar role={role} bare />
        </div>
        <button
          onClick={() => { closeDrawer(); logout(); }}
          className="flex items-center gap-2.5 px-4 py-3 text-[13px] font-medium text-red-600 border-t border-slate-100 hover:bg-red-50 transition-colors duration-150 active:scale-[0.98]"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>{t("nav.logout")}</span>
        </button>
      </div>
    </>
  );
}
