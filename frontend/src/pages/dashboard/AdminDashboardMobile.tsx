import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { ROUTES } from "@/constants/routes";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAdminDashboardData } from "./useAdminDashboardData";
import {
  ShieldCheck,
  DollarSign,
  RefreshCw,
  AlertTriangle,
  Settings,
  ClipboardList,
  FileText,
  Activity,
  Package,
  ChevronLeft,
} from "lucide-react";

// No supplier-home/importer-home-style reference HTML exists for the admin
// dashboard (checked handoff-designs/ — none). Stacked single column per
// CLAUDE.md's mandatory mobile pattern, same slate-only admin theme as
// AdminDashboardDesktop.tsx and the same 4 quick links (no "إدارة
// المستخدمين" shortcut — it would point at the unrelated settings stub
// since T9.3 hasn't built the real user-management page yet).
const QUICK_LINKS = [
  { to: ROUTES.PRICING.RULES, icon: Settings, label: "قواعد التسعير", desc: "إدارة، تعديل، إضافة" },
  { to: ROUTES.RFQ.LIST, icon: ClipboardList, label: "كل طلبات العروض", desc: "عرض وإدارة الكل" },
  { to: ROUTES.QUOTES.LIST, icon: FileText, label: "كل عروض الأسعار", desc: "جميع عروض النظام" },
  { to: ROUTES.ADMIN.MONITOR, icon: Activity, label: "مراقبة النظام", desc: "حالة الخدمات" },
] as const;

export function AdminDashboardMobile() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const {
    stats,
    statsLoading,
    aiCosts,
    aiCostsLoading,
    refreshAiCosts,
    activeRules,
    rulesLoading,
  } = useAdminDashboardData();

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              لوحة التحكم{user?.full_name ? ` — ${user.full_name}` : ""}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">إحصائيات النظام والإدارة السريعة</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            مشرف
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard value={statsLoading ? "..." : (stats?.total_rfqs ?? 0)} label="طلبات العروض" />
        <StatCard value={statsLoading ? "..." : (stats?.total_quotations ?? 0)} label="عروض الأسعار" />
        <StatCard value={statsLoading ? "..." : (stats?.total_users ?? 0)} label="المستخدمين" />
        <StatCard value={statsLoading ? "..." : (stats?.total_catalog_products ?? 0)} label="منتجات الكتالوج" />
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">تكاليف الذكاء الاصطناعي</h2>
          </div>
          <button
            onClick={refreshAiCosts}
            className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-600 active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {aiCostsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ) : aiCosts ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5">
              <span className="text-xs text-slate-600">إجمالي التكلفة</span>
              <span className="text-sm font-bold text-slate-900 tabular-nums" dir="ltr">
                ${parseFloat(aiCosts.total_cost || "0").toFixed(4)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5">
              <span className="text-xs text-slate-600">عدد الاستدعاءات</span>
              <span className="text-sm font-bold text-slate-900 tabular-nums">{aiCosts.total_calls ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5">
              <span className="text-xs text-slate-600">آخر 24 ساعة</span>
              <span className="text-sm font-bold text-slate-900 tabular-nums" dir="ltr">
                ${parseFloat(aiCosts.cost_last_24h || "0").toFixed(4)}
              </span>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center text-xs text-slate-400">
            <AlertTriangle className="mx-auto h-5 w-5 text-amber-400" />
            <p className="mt-1.5">بيانات التكاليف غير متوفرة</p>
          </div>
        )}
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Settings className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">الإدارة السريعة</h2>
        </div>
        <div className="space-y-2">
          {QUICK_LINKS.map(({ to, icon: Icon, label, desc }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-2.5 text-start transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-start">
                  <p className="text-sm font-medium text-slate-900">{label}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
              </div>
              <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">قواعد التسعير النشطة</h2>
          <button
            onClick={() => navigate(ROUTES.PRICING.RULES)}
            className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-white transition-all duration-150 hover:bg-slate-900 active:scale-[0.98]"
          >
            إدارة
          </button>
        </div>

        {rulesLoading && (
          <div className="space-y-2 p-4">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        )}

        {!rulesLoading && activeRules.length === 0 && (
          <div className="p-4">
            <EmptyState icon={Package} title="لا توجد قواعد تسعير نشطة" />
          </div>
        )}

        {!rulesLoading && activeRules.length > 0 && (
          <div className="divide-y divide-slate-100">
            {activeRules.slice(0, 10).map((rule) => (
              <div key={rule.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{rule.name}</p>
                  <p className="text-xs text-slate-500">
                    {rule.category} · {rule.rule_type}
                  </p>
                </div>
                <span className="text-sm font-medium text-slate-900 tabular-nums">
                  {rule.rule_type === "percentage" ? `${rule.value}%` : `${rule.value} ${rule.currency || ""}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
