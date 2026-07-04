import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, BarChart2, Users, Package, FileText, Calculator, Settings, UserCircle,
  ClipboardCheck, PlusCircle, Store, Truck, MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { AppLogo } from "@/components/AppLogo";
import { useAuthStore } from "@/stores/authStore";

const navItems = [
  { to: ROUTES.DASHBOARD,             label: "الرئيسية",              icon: LayoutDashboard },
  { to: ROUTES.RFQ.LIST,              label: "طلبات الشراء",          icon: BarChart2       },
  { to: ROUTES.RFQ.CREATE,            label: "طلب شراء جديد",         icon: PlusCircle      },
  { to: ROUTES.RFQ.SUPPLIER_INBOX,    label: "طلبات العملاء الواردة", icon: Users           },
  { to: ROUTES.CATALOG.MARKETPLACE,   label: "السوق العالمي",         icon: Store           },
  { to: ROUTES.SUPPLIER.MY_PRODUCTS,  label: "منتجاتي",               icon: Package         },
  { to: ROUTES.SUPPLIER.REVIEW,       label: "مراجعة المنتجات",       icon: ClipboardCheck  },
  { to: ROUTES.DOCUMENTS.UPLOAD,      label: "رفع كتالوج / مستند",    icon: FileText        },
  { to: ROUTES.PRICING.CALCULATE,     label: "حاسبة التسعير",         icon: Calculator      },
  { to: ROUTES.QUOTES.LIST,           label: "عروض الأسعار",          icon: FileText        },
  { to: ROUTES.ORDERS.LIST,           label: "تتبع الشحنات",          icon: Truck           },
  { to: ROUTES.CHAT.LIST,             label: "المحادثات",             icon: MessageCircle   },
];

const footerItems = [
  { to: ROUTES.PROFILE,  label: "ملفي الشخصي", icon: UserCircle },
  { to: ROUTES.SETTINGS, label: "الإعدادات",    icon: Settings   },
];

export function AgentSidebar() {
  const user = useAuthStore((s) => s.user);
  const initials = user?.full_name
    ?.split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("") ?? "مو";

  return (
    <aside
      className="flex h-full w-60 flex-col"
      style={{ background: "var(--surface)", borderLeft: "1px solid var(--border)" }}
      dir="rtl"
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 py-5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <AppLogo size={30} />
        <div>
          <div className="text-[14px] font-extrabold leading-tight" style={{ color: "var(--text-1)" }}>
            مركز التوريد
          </div>
          <div className="text-[8px] tracking-widest mt-0.5" style={{ color: "var(--text-3)" }} dir="ltr">
            AI SOURCING HUB
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-px">
        {navItems.map((item) => (
          <NavLink
            key={item.to + item.label}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors cursor-pointer",
                isActive ? "font-bold" : "font-medium"
              )
            }
            style={({ isActive }) =>
              isActive
                ? { background: "var(--accent-surface)", color: "#10b981" }
                : { color: "var(--text-2)" }
            }
            onMouseEnter={(e) => {
              if (!(e.currentTarget as HTMLElement).classList.contains("font-bold")) {
                (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)";
              }
            }}
            onMouseLeave={(e) => {
              if (!(e.currentTarget as HTMLElement).classList.contains("font-bold")) {
                (e.currentTarget as HTMLElement).style.background = "";
              }
            }}
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className="h-4 w-4 shrink-0"
                  style={{ color: isActive ? "#10b981" : "var(--text-2)" }}
                />
                <span className="flex-1">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: "1px solid var(--border)" }}>
        <div className="px-2 py-2 space-y-px">
          {footerItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors"
              style={{ color: "var(--text-2)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>

        <div
          className="px-3 py-3 flex items-center gap-2.5"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "var(--avatar-bg)" }}
          >
            <span className="text-[12px] font-bold" style={{ color: "var(--avatar-text)" }}>{initials}</span>
          </div>
          <div>
            <div className="text-[13px] font-semibold" style={{ color: "var(--text-dim)" }}>
              {user?.full_name ?? "المورد"}
            </div>
            <div className="text-[10px]" style={{ color: "var(--text-2)" }}>مورد معتمد</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
