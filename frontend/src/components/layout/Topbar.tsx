import { LogOut, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/authStore";
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

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-100 bg-white px-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div />

      <div className="flex items-center gap-2">
        <NotificationBell />

        <div className="mx-1 h-5 w-px bg-slate-100" />

        <button
          onClick={() => navigate(ROUTES.PROFILE)}
          className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 transition-colors hover:bg-slate-50"
          title="الملف الشخصي"
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-white shadow-sm"
            style={{ backgroundColor: user?.full_name ? stringToColor(user.full_name) : "#6b7280" }}
          >
            {user?.full_name?.charAt(0)?.toUpperCase() ?? "U"}
          </div>
          <div className="hidden text-right md:block">
            <p className="text-sm font-medium text-slate-800 leading-tight">{user?.full_name}</p>
            <p className="text-xs text-slate-400 leading-tight">
              {ROLE_LABELS[user?.role ?? ""] ?? "مستخدم"}
            </p>
          </div>
          <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 md:block" />
        </button>

        <button
          onClick={logout}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
          title="تسجيل الخروج"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
