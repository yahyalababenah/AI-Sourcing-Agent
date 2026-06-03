import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  Upload,
  Calculator,
  FileText,
  Package,
  BarChart3,
  Users,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";

/**
 * Admin Sidebar (God Mode) — Full access to everything including admin-only sections.
 */
export function AdminSidebar() {
  const mainItems = [
    { to: ROUTES.DASHBOARD, label: "لوحة التحكم", icon: LayoutDashboard },
    { to: ROUTES.RFQ.LIST, label: "طلبات الشراء", icon: ClipboardList },
    { to: ROUTES.RFQ.CREATE, label: "طلب شراء جديد", icon: Package },
    { to: ROUTES.DOCUMENTS.UPLOAD, label: "رفع مستند", icon: Upload },
    { to: ROUTES.PRICING.CALCULATE, label: "حساب الأسعار", icon: Calculator },
    { to: ROUTES.QUOTES.LIST, label: "عروض الأسعار", icon: FileText },
  ];

  const adminItems = [
    { to: ROUTES.PRICING.RULES, label: "قواعد التسعير", icon: DollarSign },
    { to: ROUTES.SETTINGS, label: "إدارة المستخدمين", icon: Users },
    { to: ROUTES.SETTINGS, label: "سجلات النظام", icon: BarChart3 },
  ];

  return (
    <aside className="flex h-full w-64 flex-col border-l border-gray-200 bg-white rtl:border-l-0 rtl:border-r">
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b border-gray-200 px-6">
        <h1 className="text-xl font-bold text-primary-700">AI-Sourcing Hub</h1>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {mainItems.map((item) => (
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

        {/* Admin Section Divider */}
        <div className="my-3 border-t border-gray-200 pt-3">
          <p className="mb-2 px-3 text-xs font-semibold uppercase text-gray-500">
            👑 الإدارة (God Mode)
          </p>
        </div>

        {adminItems.map((item) => (
          <NavLink
            key={item.to + item.label}
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
      </nav>
    </aside>
  );
}
