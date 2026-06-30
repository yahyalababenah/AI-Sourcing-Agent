import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, ClipboardList, Globe, Truck, MessageCircle,
  BarChart2, Users, Package, FileText, Activity, DollarSign,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { ROUTES } from "@/constants/routes";

// ── Per-role tab definitions ─────────────────────────────────────────────────

const CLIENT_TABS = [
  { to: ROUTES.DASHBOARD,            label: "الرئيسية",  icon: LayoutDashboard },
  { to: ROUTES.RFQ.LIST,             label: "طلباتي",    icon: ClipboardList   },
  { to: ROUTES.CATALOG.MARKETPLACE,  label: "السوق",     icon: Globe           },
  { to: ROUTES.ORDERS.LIST,          label: "شحناتي",    icon: Truck           },
  { to: ROUTES.CHAT.LIST,            label: "المحادثات", icon: MessageCircle   },
];

const AGENT_TABS = [
  { to: ROUTES.DASHBOARD,           label: "الرئيسية",   icon: LayoutDashboard },
  { to: ROUTES.RFQ.LIST,            label: "الطلبات",    icon: BarChart2       },
  { to: ROUTES.RFQ.SUPPLIER_INBOX,  label: "العملاء",    icon: Users           },
  { to: ROUTES.CATALOG.MARKETPLACE, label: "الموردون",   icon: Package         },
  { to: ROUTES.DOCUMENTS.UPLOAD,    label: "الكتالوج",   icon: FileText        },
];

const ADMIN_TABS = [
  { to: ROUTES.DASHBOARD,       label: "الرئيسية",  icon: LayoutDashboard },
  { to: ROUTES.RFQ.LIST,        label: "الطلبات",   icon: ClipboardList   },
  { to: ROUTES.ADMIN.MONITOR,   label: "المراقبة",  icon: Activity        },
  { to: ROUTES.PRICING.RULES,   label: "التسعير",   icon: DollarSign      },
  { to: ROUTES.QUOTES.LIST,     label: "العروض",    icon: FileText        },
];

const TABS_BY_ROLE = {
  client: CLIENT_TABS,
  agent:  AGENT_TABS,
  admin:  ADMIN_TABS,
} as const;

// ── Component ────────────────────────────────────────────────────────────────

export function MobileTabBar() {
  const role = useAuthStore((s) => s.role);
  const tabs = role ? TABS_BY_ROLE[role] : CLIENT_TABS;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex items-start justify-around lg:hidden"
      style={{
        height: "64px",
        paddingTop: "8px",
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className="flex flex-col items-center gap-0.5 px-3 py-1"
        >
          {({ isActive }) => (
            <>
              <tab.icon
                className="h-5 w-5 shrink-0"
                style={{ color: isActive ? "#059669" : "var(--text-3)" }}
              />
              <span
                className="text-[9px] font-semibold"
                style={{ color: isActive ? "#059669" : "var(--text-3)" }}
              >
                {tab.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
