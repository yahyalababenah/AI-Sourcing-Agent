import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, ClipboardList, Globe, Truck, MessageCircle,
  BarChart2, Package, Store, Activity, ShieldCheck, DollarSign, ReceiptText,
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
  { to: ROUTES.DASHBOARD,             label: "الرئيسية",  icon: LayoutDashboard },
  { to: ROUTES.RFQ.LIST,              label: "الطلبات",   icon: BarChart2       },
  { to: ROUTES.SUPPLIER.MY_PRODUCTS,  label: "منتجاتي",   icon: Package         },
  { to: ROUTES.CATALOG.MARKETPLACE,   label: "السوق",     icon: Store           },
  { to: ROUTES.CHAT.LIST,             label: "المحادثات", icon: MessageCircle   },
];

const ADMIN_TABS = [
  { to: ROUTES.DASHBOARD,          label: "الرئيسية",  icon: LayoutDashboard },
  { to: ROUTES.ADMIN.MONITOR,      label: "المراقبة",  icon: Activity        },
  { to: ROUTES.ADMIN.VERIFICATION, label: "التوثيق",   icon: ShieldCheck     },
  { to: ROUTES.PRICING.RULES,      label: "التسعير",   icon: DollarSign      },
  { to: ROUTES.ADMIN.HS_CODES,     label: "رموز HS",   icon: ReceiptText     },
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
