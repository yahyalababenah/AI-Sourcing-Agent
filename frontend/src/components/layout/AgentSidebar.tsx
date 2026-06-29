import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, ClipboardList, Upload, Calculator, FileText,
  Settings, Package, Inbox, Truck, Store, MessageCircle, UserCircle, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";

const navItems = [
  { to: ROUTES.DASHBOARD,           label: "لوحة التحكم",        icon: LayoutDashboard },
  { to: ROUTES.RFQ.SUPPLIER_INBOX,  label: "صندوق المورد",        icon: Inbox },
  { to: ROUTES.RFQ.LIST,            label: "طلبات الشراء",        icon: ClipboardList },
  { to: ROUTES.RFQ.CREATE,          label: "طلب شراء جديد",       icon: Package },
  { to: ROUTES.DOCUMENTS.UPLOAD,    label: "رفع مستند",           icon: Upload },
  { to: ROUTES.SUPPLIER.MY_PRODUCTS,label: "منتجاتي",             icon: Store },
  { to: ROUTES.SUPPLIER.REVIEW,     label: "مراجعة المنتجات",     icon: Package },
  { to: ROUTES.PRICING.CALCULATE,   label: "حساب الأسعار",        icon: Calculator },
  { to: ROUTES.QUOTES.LIST,         label: "عروض الأسعار",        icon: FileText },
  { to: ROUTES.CHAT.LIST,           label: "المحادثات",           icon: MessageCircle },
  { to: ROUTES.ORDERS.LIST,         label: "تتبع الشحنات",        icon: Truck },
];

const footerItems = [
  { to: ROUTES.PROFILE,  label: "ملفي الشخصي", icon: UserCircle },
  { to: ROUTES.SETTINGS, label: "الإعدادات",    icon: Settings },
];

export function AgentSidebar() {
  return (
    <aside className="flex h-full w-64 flex-col bg-[#0f172a]">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-white/5 px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/20">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-white">AI-Sourcing Hub</p>
          <p className="text-[10px] text-slate-500">لوحة الوكيل</p>
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
      <div className="space-y-0.5 border-t border-white/5 px-3 py-3">
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
