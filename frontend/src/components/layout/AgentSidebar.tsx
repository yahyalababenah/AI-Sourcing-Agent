import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, BarChart2, Users, Package, FileText, TrendingUp, Settings, UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { AppLogo } from "@/components/AppLogo";
import { useAuthStore } from "@/stores/authStore";

const navItems = [
  { to: ROUTES.DASHBOARD,            label: "الرئيسية",       icon: LayoutDashboard },
  { to: ROUTES.RFQ.LIST,             label: "خط الأنابيب",    icon: BarChart2      },
  { to: ROUTES.RFQ.SUPPLIER_INBOX,   label: "العملاء",         icon: Users,         badge: "14" },
  { to: ROUTES.CATALOG.MARKETPLACE,  label: "الموردون",        icon: Package        },
  { to: ROUTES.DOCUMENTS.UPLOAD,     label: "الكتالوجات",      icon: FileText,      badgeAmber: "3" },
  { to: ROUTES.PRICING.CALCULATE,    label: "التقارير",        icon: TrendingUp     },
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
    .join("") ?? "وك";

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
                {item.badge && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: "var(--surface-3)", color: "var(--text-4)" }}
                  >
                    {item.badge}
                  </span>
                )}
                {item.badgeAmber && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: "var(--amber-surface)", color: "#d97706" }}
                  >
                    {item.badgeAmber}
                  </span>
                )}
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
              {user?.full_name ?? "الوكيل"}
            </div>
            <div className="text-[10px]" style={{ color: "var(--text-2)" }}>وكيل مميّز</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
