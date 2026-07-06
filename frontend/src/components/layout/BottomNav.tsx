import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, Users, Clapperboard, MessageCircle, UserCircle,
  Compass, Activity, ShieldCheck, type LucideIcon,
} from "lucide-react";
import { ROUTES } from "@/constants/routes";
import type { UserRole } from "@/types/auth";

interface Tab {
  to: string;
  labelKey: string;
  icon: LucideIcon;
}

// Max 5 items per role, matching CLAUDE.md's mandatory mobile bottom-nav
// lists literally: agent = home/incoming/reels/chat/account,
// client = home/discover/reels/chat/account.
const CLIENT_TABS: Tab[] = [
  { to: ROUTES.CLIENT.DASHBOARD,    labelKey: "bottomNav.home",     icon: LayoutDashboard },
  { to: ROUTES.CATALOG.MARKETPLACE, labelKey: "bottomNav.discover", icon: Compass },
  { to: ROUTES.CLIENT.REELS,        labelKey: "bottomNav.reels",    icon: Clapperboard },
  { to: ROUTES.CHAT.LIST,           labelKey: "bottomNav.chat",     icon: MessageCircle },
  { to: ROUTES.PROFILE,             labelKey: "bottomNav.account",  icon: UserCircle },
];

const AGENT_TABS: Tab[] = [
  { to: ROUTES.AGENT.DASHBOARD,   labelKey: "bottomNav.home",     icon: LayoutDashboard },
  { to: ROUTES.RFQ.SUPPLIER_INBOX,labelKey: "bottomNav.incoming", icon: Users },
  { to: ROUTES.AGENT.REELS,       labelKey: "bottomNav.myReels",  icon: Clapperboard },
  { to: ROUTES.CHAT.LIST,         labelKey: "bottomNav.chat",     icon: MessageCircle },
  { to: ROUTES.PROFILE,           labelKey: "bottomNav.account",  icon: UserCircle },
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
  client: "#15568F",
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
      className="fixed bottom-0 start-0 end-0 z-30 flex items-start justify-around bg-white border-t border-slate-200 lg:hidden"
      style={{ height: "64px", paddingTop: "8px", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className="flex min-h-11 flex-col items-center justify-center gap-0.5 px-3 py-1 transition-transform duration-150 active:scale-[0.98]"
        >
          {({ isActive }) => (
            <>
              <tab.icon
                className="h-5 w-5 shrink-0 transition-colors duration-150"
                style={{ color: isActive ? activeColor : "#94a3b8" }}
              />
              <span
                className="text-[9px] font-semibold transition-colors duration-150"
                style={{ color: isActive ? activeColor : "#94a3b8" }}
              >
                {t(tab.labelKey)}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
