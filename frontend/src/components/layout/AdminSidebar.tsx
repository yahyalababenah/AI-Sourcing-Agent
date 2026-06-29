import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, ClipboardList, Upload, Calculator, FileText,
  Package, Activity, Users, DollarSign, Store, Truck, ShieldCheck,
  MessageCircle, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";

const mainItems = [
  { to: ROUTES.DASHBOARD,        label: "لوحة التحكم",   icon: LayoutDashboard },
  { to: ROUTES.RFQ.LIST,         label: "طلبات الشراء",   icon: ClipboardList },
  { to: ROUTES.RFQ.CREATE,       label: "طلب شراء جديد",  icon: Package },
  { to: ROUTES.DOCUMENTS.UPLOAD, label: "رفع مستند",      icon: Upload },
  { to: ROUTES.PRICING.CALCULATE,label: "حساب الأسعار",   icon: Calculator },
  { to: ROUTES.QUOTES.LIST,      label: "عروض الأسعار",   icon: FileText },
  { to: ROUTES.ORDERS.LIST,      label: "تتبع الشحنات",   icon: Truck },
  { to: ROUTES.CHAT.LIST,        label: "المحادثات",      icon: MessageCircle },
];

const adminItems = [
  { to: ROUTES.ADMIN.MONITOR,      label: "مراقبة النظام",    icon: Activity },
  { to: ROUTES.ADMIN.VERIFICATION, label: "توثيق الموردين",   icon: ShieldCheck },
  { to: ROUTES.PRICING.RULES,      label: "قواعد التسعير",    icon: DollarSign },
  { to: ROUTES.CATALOG.MARKETPLACE,label: "الكتالوج العالمي", icon: Store },
  { to: ROUTES.SETTINGS,           label: "إدارة المستخدمين", icon: Users },
];

export function AdminSidebar() {
  return (
    <aside className="flex h-full w-64 flex-col bg-[#0f172a]">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-white/5 px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/20">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-white">AI-Sourcing Hub</p>
          <p className="text-[10px] text-slate-500">لوحة الإدارة</p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {mainItems.map((item) => (
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

        {/* Admin Section Divider */}
        <div className="pt-4 pb-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            الإدارة
          </p>
        </div>

        {adminItems.map((item) => (
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
    </aside>
  );
}
