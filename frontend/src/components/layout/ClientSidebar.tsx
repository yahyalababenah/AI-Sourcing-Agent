import { NavLink } from "react-router-dom";
import { ClipboardList, Package, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";

/**
 * Client Sidebar — Only shows RFQ creation and their own RFQs list.
 */
export function ClientSidebar() {
  const navItems = [
    { to: ROUTES.DASHBOARD, label: "لوحة التحكم", icon: ClipboardList },
    { to: ROUTES.RFQ.CREATE, label: "طلب عرض سعر جديد", icon: Package },
    { to: ROUTES.RFQ.LIST, label: "طلباتي", icon: ClipboardList },
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
