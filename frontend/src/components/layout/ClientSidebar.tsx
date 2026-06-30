import { NavLink } from "react-router-dom";
import { ClipboardList, Package, Globe, Settings, Truck, MessageCircle, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { AppLogo } from "@/components/AppLogo";

const navItems = [
  { to: ROUTES.DASHBOARD,           label: "لوحة التحكم",       icon: ClipboardList },
  { to: ROUTES.CATALOG.MARKETPLACE, label: "السوق العالمي",      icon: Globe },
  { to: ROUTES.RFQ.CREATE,          label: "طلب عرض سعر جديد",  icon: Package },
  { to: ROUTES.RFQ.LIST,            label: "طلباتي",             icon: ClipboardList },
  { to: ROUTES.CHAT.LIST,           label: "المحادثات",          icon: MessageCircle },
  { to: ROUTES.ORDERS.LIST,         label: "تتبع الشحنات",       icon: Truck },
];

const footerItems = [
  { to: ROUTES.PROFILE,  label: "ملفي الشخصي", icon: UserCircle },
  { to: ROUTES.SETTINGS, label: "الإعدادات",    icon: Settings },
];

export function ClientSidebar() {
  return (
    <aside
      className="flex h-full w-64 flex-col"
      style={{ background: "var(--sidebar-bg)" }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 py-5"
        style={{ borderBottom: "1px solid var(--sidebar-border)" }}
      >
        <AppLogo size={30} />
        <div>
          <p className="text-[14px] font-extrabold leading-tight" style={{ color: "var(--sidebar-text)" }}>
            مركز التوريد
          </p>
          <p className="text-[8px] tracking-widest mt-0.5" style={{ color: "var(--sidebar-muted)" }} dir="ltr">
            AI SOURCING HUB
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to + item.label}
            to={item.to}
            className={({ isActive }) =>
              cn("sidebar-link", isActive ? "sidebar-link-active" : "sidebar-link-inactive")
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div
        className="space-y-0.5 px-3 py-3"
        style={{ borderTop: "1px solid var(--sidebar-border)" }}
      >
        {footerItems.map((item) => (
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
      </div>
    </aside>
  );
}
