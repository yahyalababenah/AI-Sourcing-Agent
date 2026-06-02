import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  Upload,
  Calculator,
  FileText,
  Settings,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { useAuthStore } from "@/stores/authStore";

const navItems = [
  { to: ROUTES.DASHBOARD, label: "لوحة التحكم", icon: LayoutDashboard }, // Dashboard
  { to: ROUTES.RFQ.LIST, label: "طلبات الشراء", icon: ClipboardList }, // RFQs
  { to: ROUTES.RFQ.CREATE, label: "طلب شراء جديد", icon: Package }, // New RFQ
  { to: ROUTES.DOCUMENTS.UPLOAD, label: "رفع مستند", icon: Upload }, // Upload Document
  { to: ROUTES.PRICING.CALCULATE, label: "حساب الأسعار", icon: Calculator }, // Pricing Calculator
  { to: ROUTES.QUOTES.LIST, label: "عروض الأسعار", icon: FileText }, // Quotations
];

const adminItems = [
  { to: ROUTES.PRICING.RULES, label: "قواعد التسعير", icon: Settings }, // Pricing Rules
];

export function Sidebar() {
  const role = useAuthStore((s) => s.role);

  return (
    <aside className="flex h-full w-64 flex-col border-l border-gray-200 bg-white rtl:border-l-0 rtl:border-r">
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b border-gray-200 px-6">
        <h1 className="text-xl font-bold text-primary-700">AI-Sourcing Hub</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "sidebar-link",
                isActive ? "sidebar-link-active" : "sidebar-link-inactive"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}

        {/* Admin-only items */}
        {role === "admin" && (
          <>
            <div className="my-3 border-t border-gray-200 pt-3">
              <p className="mb-2 px-3 text-xs font-semibold uppercase text-gray-500">
                الإدارة
              </p>
            </div>
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "sidebar-link",
                    isActive ? "sidebar-link-active" : "sidebar-link-inactive"
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4">
        <NavLink
          to={ROUTES.SETTINGS}
          className={({ isActive }) =>
            cn(
              "sidebar-link",
              isActive ? "sidebar-link-active" : "sidebar-link-inactive"
            )
          }
        >
          <Settings className="h-5 w-5" />
          <span>الإعدادات</span> {/* Settings */}
        </NavLink>
      </div>
    </aside>
  );
}
