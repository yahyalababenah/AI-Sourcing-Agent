import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, ClipboardList, Globe, Truck, MessageCircle,
  Package, Store, Activity, ShieldCheck, type LucideIcon,
} from "lucide-react";
import { ROUTES } from "@/constants/routes";
import type { UserRole } from "@/types/auth";

interface Tab {
  to: string;
  labelKey: string;
  icon: LucideIcon;
}

// Max 5 items per role, per CLAUDE.md's mandatory mobile bottom-nav rule.
const CLIENT_TABS: Tab[] = [
  { to: ROUTES.CLIENT.DASHBOARD,   labelKey: "nav.home",          icon: LayoutDashboard },
  { to: ROUTES.RFQ.LIST,           labelKey: "nav.myRequests",    icon: ClipboardList },
  { to: ROUTES.CATALOG.MARKETPLACE,labelKey: "nav.marketplace",   icon: Globe },
  { to: ROUTES.ORDERS.LIST,        labelKey: "nav.shipmentTracking", icon: Truck },
  { to: ROUTES.CHAT.LIST,          labelKey: "nav.chat",          icon: MessageCircle },
];

const AGENT_TABS: Tab[] = [
  { to: ROUTES.AGENT.DASHBOARD,     labelKey: "nav.home",       icon: LayoutDashboard },
  { to: ROUTES.RFQ.LIST,            labelKey: "nav.purchaseRequests", icon: ClipboardList },
  { to: ROUTES.SUPPLIER.MY_PRODUCTS,labelKey: "nav.myProducts", icon: Package },
  { to: ROUTES.CATALOG.MARKETPLACE, labelKey: "nav.marketplace",icon: Store },
  { to: ROUTES.CHAT.LIST,           labelKey: "nav.chat",       icon: MessageCircle },
];

const ADMIN_TABS: Tab[] = [
  { to: ROUTES.ADMIN.DASHBOARD,     labelKey: "nav.home",                icon: LayoutDashboard },
  { to: ROUTES.ADMIN.MONITOR,       labelKey: "nav.systemMonitor",       icon: Activity },
  { to: ROUTES.ADMIN.VERIFICATION,  labelKey: "nav.supplierVerification",icon: ShieldCheck },
];

const TABS_BY_ROLE: Record<UserRole, Tab[]> = {
  client: CLIENT_TABS,
  agent: AGENT_TABS,
  admin: ADMIN_TABS,
};

const ACTIVE_COLOR: Record<UserRole, string> = {
  agent: "#0F6E56",
  client: "#4338CA",
  admin: "#0f172a",
};

interface BottomNavProps {
  role: UserRole;
}

export function BottomNav({ role }: BottomNavProps) {
  const { t } = useTranslation();
  const tabs = TABS_BY_ROLE[role];
  const activeColor = ACTIVE_COLOR[role];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex items-start justify-around bg-white border-t border-slate-200 lg:hidden"
      style={{ height: "64px", paddingTop: "8px", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map((tab) => (
        <NavLink key={tab.to} to={tab.to} className="flex flex-col items-center gap-0.5 px-3 py-1">
          {({ isActive }) => (
            <>
              <tab.icon className="h-5 w-5 shrink-0" style={{ color: isActive ? activeColor : "#94a3b8" }} />
              <span className="text-[9px] font-semibold" style={{ color: isActive ? activeColor : "#94a3b8" }}>
                {t(tab.labelKey)}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
