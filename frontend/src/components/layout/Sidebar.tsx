import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, ClipboardList, PlusCircle, Users, Store, Package, Upload,
  ClipboardCheck, FileText, Calculator, Truck, MessageCircle, Clapperboard,
  Globe, Activity, ShieldCheck, DollarSign, ReceiptText, Settings, UserCircle,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { AppLogo } from "@/components/AppLogo";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import type { UserRole } from "@/types/auth";

interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
}

const AGENT_NAV: NavItem[] = [
  { to: ROUTES.AGENT.DASHBOARD,      labelKey: "nav.home",                  icon: LayoutDashboard },
  { to: ROUTES.RFQ.LIST,             labelKey: "nav.purchaseRequests",      icon: ClipboardList },
  { to: ROUTES.RFQ.SUPPLIER_INBOX,   labelKey: "nav.incomingClientRequests",icon: Users },
  { to: ROUTES.CATALOG.MARKETPLACE,  labelKey: "nav.marketplace",           icon: Store },
  { to: ROUTES.SUPPLIER.MY_PRODUCTS, labelKey: "nav.myProducts",            icon: Package },
  { to: ROUTES.DOCUMENTS.UPLOAD,     labelKey: "nav.uploadDocument",        icon: Upload },
  { to: ROUTES.SUPPLIER.REVIEW,      labelKey: "nav.productReview",         icon: ClipboardCheck },
  { to: ROUTES.PRICING.CALCULATE,    labelKey: "nav.calculator",            icon: Calculator },
  { to: ROUTES.QUOTES.LIST,          labelKey: "nav.quotes",                icon: FileText },
  { to: ROUTES.ORDERS.LIST,          labelKey: "nav.shipmentTracking",      icon: Truck },
  { to: ROUTES.CHAT.LIST,            labelKey: "nav.chat",                  icon: MessageCircle },
  { to: ROUTES.AGENT.REELS,          labelKey: "nav.reels",                 icon: Clapperboard },
];

const CLIENT_NAV: NavItem[] = [
  { to: ROUTES.CLIENT.DASHBOARD,    labelKey: "nav.dashboard",  icon: LayoutDashboard },
  { to: ROUTES.CATALOG.MARKETPLACE, labelKey: "nav.marketplace",icon: Globe },
  { to: ROUTES.RFQ.CREATE,          labelKey: "nav.newRfq",     icon: PlusCircle },
  { to: ROUTES.RFQ.LIST,            labelKey: "nav.myRequests", icon: ClipboardList },
  { to: ROUTES.CHAT.LIST,           labelKey: "nav.chat",       icon: MessageCircle },
  { to: ROUTES.ORDERS.LIST,         labelKey: "nav.shipmentTracking", icon: Truck },
];

const ADMIN_NAV: NavItem[] = [
  { to: ROUTES.ADMIN.DASHBOARD,     labelKey: "nav.dashboard",           icon: LayoutDashboard },
  { to: ROUTES.ADMIN.MONITOR,       labelKey: "nav.systemMonitor",       icon: Activity },
  { to: ROUTES.ADMIN.VERIFICATION,  labelKey: "nav.supplierVerification",icon: ShieldCheck },
  { to: ROUTES.PRICING.RULES,       labelKey: "nav.pricingRules",        icon: DollarSign },
  { to: ROUTES.ADMIN.HS_CODES,      labelKey: "nav.hsCodeSchedules",     icon: ReceiptText },
  { to: ROUTES.CATALOG.MARKETPLACE, labelKey: "nav.globalCatalog",       icon: Store },
  { to: ROUTES.ADMIN.USERS,         labelKey: "nav.userManagement",      icon: UserCog },
];

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  agent: AGENT_NAV,
  client: CLIENT_NAV,
  admin: ADMIN_NAV,
};

// Active-state accent per role — supplier(green)/importer(navy blue)/slate(admin).
const ACCENT_BY_ROLE: Record<UserRole, { text: string; bg: string }> = {
  agent:  { text: "text-supplier-600", bg: "bg-supplier-50" },
  client: { text: "text-importer-600", bg: "bg-importer-50" },
  admin:  { text: "text-slate-900",    bg: "bg-slate-100" },
};

interface SidebarProps {
  role: UserRole;
  /** Render without the fixed width wrapper (used inside MobileDrawer). */
  bare?: boolean;
}

export function Sidebar({ role, bare = false }: SidebarProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const closeDrawer = useUIStore((s) => s.closeDrawer);
  const items = NAV_BY_ROLE[role];
  const accent = ACCENT_BY_ROLE[role];

  const content = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-100">
        <AppLogo size={30} />
        <div>
          <p className="text-[14px] font-extrabold leading-tight text-slate-900">
            مركز التوريد
          </p>
          <p className="text-[8px] tracking-widest mt-0.5 text-slate-400" dir="ltr">
            AI SOURCING HUB
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={closeDrawer}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors",
                isActive ? cn("font-bold", accent.text, accent.bg) : "font-medium text-slate-600 hover:bg-slate-50"
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-100 px-2 py-2 space-y-0.5">
        <NavLink
          to={ROUTES.PROFILE}
          onClick={closeDrawer}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium text-slate-600 hover:bg-slate-50"
        >
          <UserCircle className="h-4 w-4 shrink-0" />
          <span>{t("nav.profile")}</span>
        </NavLink>
        <NavLink
          to={ROUTES.SETTINGS}
          onClick={closeDrawer}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium text-slate-600 hover:bg-slate-50"
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>{t("nav.settings")}</span>
        </NavLink>

        <div className="px-2.5 py-3 flex items-center gap-2.5">
          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", accent.bg)}>
            <span className={cn("text-[12px] font-bold", accent.text)}>
              {user?.full_name?.charAt(0)?.toUpperCase() ?? "U"}
            </span>
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-slate-900 truncate">
              {user?.full_name ?? "—"}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  if (bare) {
    return <div className="flex h-full w-full flex-col bg-white" dir="rtl">{content}</div>;
  }

  return (
    <aside className="flex h-full w-64 flex-col bg-white border-e border-slate-200" dir="rtl">
      {content}
    </aside>
  );
}
