import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  Upload,
  Calculator,
  FileText,
  Settings,
  Package,
  Inbox,
  Truck,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";

/**
 * Agent Sidebar — Full workflow: RFQs, Documents, Pricing, Quotations, Tracking, Catalog.
 */
export function AgentSidebar() {
  const navItems = [
    { to: ROUTES.DASHBOARD, label: "لوحة التحكم", icon: LayoutDashboard },
    { to: ROUTES.RFQ.SUPPLIER_INBOX, label: "صندوق المورد", icon: Inbox },
    { to: ROUTES.RFQ.LIST, label: "طلبات الشراء", icon: ClipboardList },
    { to: ROUTES.RFQ.CREATE, label: "طلب شراء جديد", icon: Package },
    { to: ROUTES.DOCUMENTS.UPLOAD, label: "رفع مستند", icon: Upload },
    { to: ROUTES.SUPPLIER.MY_PRODUCTS, label: "منتجاتي", icon: Store },
    { to: ROUTES.PRICING.CALCULATE, label: "حساب الأسعار", icon: Calculator },
    { to: ROUTES.QUOTES.LIST, label: "عروض الأسعار", icon: FileText },
    { to: ROUTES.ORDERS.LIST, label: "تتبع الشحنات", icon: Truck },
  ];

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
          <span>الإعدادات</span>
        </NavLink>
      </div>
    </aside>
  );
}
