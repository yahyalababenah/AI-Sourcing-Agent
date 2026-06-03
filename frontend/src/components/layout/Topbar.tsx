import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/authStore";
import { stringToColor } from "@/lib/utils";

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const { logout } = useAuth();

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      {/* Page title area — could be dynamic */}
      <div />

      {/* User menu */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium text-white"
            style={{
              backgroundColor: user?.full_name
                ? stringToColor(user.full_name)
                : "#6b7280",
            }}
          >
            {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
          </div>

          <div className="text-sm">
            <p className="font-medium text-gray-900">{user?.full_name}</p>
            <p className="text-xs text-gray-500">
              {user?.role === "admin"
                ? "مدير النظام"
                : user?.role === "client"
                ? "عميل"
                : "وكيل"}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
          title="تسجيل الخروج"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden md:inline">خروج</span>
        </button>
      </div>
    </header>
  );
}
