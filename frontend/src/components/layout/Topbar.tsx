import { LogOut, ChevronDown, Sun, Moon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { stringToColor } from "@/lib/utils";
import { NotificationBell } from "@/components/NotificationBell";
import { ROUTES } from "@/constants/routes";

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير النظام",
  client: "عميل",
  agent: "وكيل",
};

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggle } = useThemeStore();

  return (
    <header
      className="flex h-14 items-center justify-between px-6"
      style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
    >
      <div />

      <div className="flex items-center gap-2">
        <NotificationBell />

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
          style={{ color: "var(--text-2)" }}
          title={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
        >
          {theme === "dark"
            ? <Sun className="h-4 w-4" />
            : <Moon className="h-4 w-4" />}
        </button>

        <div className="mx-1 h-5 w-px" style={{ background: "var(--border)" }} />

        <button
          onClick={() => navigate(ROUTES.PROFILE)}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors"
          style={{ color: "var(--text-1)" }}
          title="الملف الشخصي"
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: user?.full_name ? stringToColor(user.full_name) : "#059669" }}
          >
            {user?.full_name?.charAt(0)?.toUpperCase() ?? "U"}
          </div>
          <div className="hidden text-right md:block">
            <p className="text-sm font-medium leading-tight" style={{ color: "var(--text-1)" }}>
              {user?.full_name}
            </p>
            <p className="text-xs leading-tight" style={{ color: "var(--text-2)" }}>
              {ROLE_LABELS[user?.role ?? ""] ?? "مستخدم"}
            </p>
          </div>
          <ChevronDown className="hidden h-3.5 w-3.5 md:block" style={{ color: "var(--text-2)" }} />
        </button>

        <button
          onClick={logout}
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-red-500/10"
          style={{ color: "var(--text-2)" }}
          title="تسجيل الخروج"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
