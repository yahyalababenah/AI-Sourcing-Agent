import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, ClipboardList, Upload, Calculator,
  FileText, Settings, Package, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { useAuthStore } from "@/stores/authStore";

const navItems = [
  { to: ROUTES.DASHBOARD,          label: "لوحة التحكم",  icon: LayoutDashboard },
  { to: ROUTES.RFQ.LIST,           label: "طلبات الشراء",  icon: ClipboardList },
  { to: ROUTES.RFQ.CREATE,         label: "طلب شراء جديد", icon: Package },
  { to: ROUTES.DOCUMENTS.UPLOAD,   label: "رفع مستند",     icon: Upload },
  { to: ROUTES.PRICING.CALCULATE,  label: "حساب الأسعار",  icon: Calculator },
  { to: ROUTES.QUOTES.LIST,        label: "عروض الأسعار",  icon: FileText },
];

const adminItems = [
  { to: ROUTES.PRICING.RULES, label: "قواعد التسعير", icon: Settings },
];

export function Sidebar() {
  const role = useAuthStore((s) => s.role);

  return (
    <aside className="flex h-full w-64 flex-col" style={{ background: "var(--sidebar-bg)" }}>
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-white/5 px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/20">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-white">AI-Sourcing Hub</p>
          <p className="text-[10px] text-slate-500">بوابة الاستيراد الذكي</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn("sidebar-link", isActive ? "sidebar-link-active" : "sidebar-link-inactive")
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}

        {role === "admin" && (
          <>
            <div className="pt-4 pb-1">
              <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                الإدارة
              </p>
            </div>
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn("sidebar-link", isActive ? "sidebar-link-active" : "sidebar-link-inactive")
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/5 px-3 py-3">
        <NavLink
          to={ROUTES.SETTINGS}
          className={({ isActive }) =>
            cn("sidebar-link", isActive ? "sidebar-link-active" : "sidebar-link-inactive")
          }
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>الإعدادات</span>
        </NavLink>
      </div>
    </aside>
  );
}
