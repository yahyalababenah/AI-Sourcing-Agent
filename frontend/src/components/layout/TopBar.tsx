import { Menu, LogOut, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { stringToColor } from "@/lib/utils";
import { NotificationBell } from "@/components/NotificationBell";
import { AppLogo } from "@/components/AppLogo";
import { ROUTES } from "@/constants/routes";

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير النظام",
  client: "مستورد",
  agent: "مورد",
};

export function TopBar() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const openDrawer = useUIStore((s) => s.openDrawer);

  return (
    <header className="flex h-14 items-center justify-between px-4 bg-white border-b border-slate-200">
      {/* Mobile: ☰ + app logo/name (per CLAUDE.md's mandatory mobile pattern) */}
      <div className="flex items-center gap-2.5 lg:hidden">
        <button
          onClick={openDrawer}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600"
          aria-label="menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <AppLogo size={26} />
        <div>
          <p className="text-[13px] font-bold leading-tight text-slate-900">مركز التوريد الذكي</p>
          <p className="text-[8px] tracking-widest text-slate-400" dir="ltr">AI SOURCING HUB</p>
        </div>
      </div>

      <div className="hidden lg:block" />

      {/* Right side actions */}
      <div className="flex items-center gap-1.5">
        <NotificationBell />

        <div className="mx-1 h-5 w-px bg-slate-200" />

        <button
          onClick={() => navigate(ROUTES.PROFILE)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-slate-900"
          title={t("nav.profile")}
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: user?.full_name ? stringToColor(user.full_name) : "#0F6E56" }}
          >
            {user?.full_name?.charAt(0)?.toUpperCase() ?? "U"}
          </div>
          <div className="hidden text-start lg:block">
            <p className="text-sm font-medium leading-tight text-slate-900">{user?.full_name}</p>
            <p className="text-xs leading-tight text-slate-500">{ROLE_LABELS[user?.role ?? ""] ?? "مستخدم"}</p>
          </div>
          <ChevronDown className="hidden h-3.5 w-3.5 lg:block text-slate-500" />
        </button>

        <button
          onClick={logout}
          className="hidden lg:flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
          title={t("nav.logout")}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
