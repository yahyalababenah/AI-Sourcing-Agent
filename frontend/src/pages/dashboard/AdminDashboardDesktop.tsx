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

// Admin screens stay slate-only per CLAUDE.md ("صفحات الأدمن: slate بحت،
// صفر طابع اجتماعي") — no supplier/importer/decorative accent colors here.
const QUICK_LINKS = [
  { to: ROUTES.PRICING.RULES, icon: Settings, label: "قواعد التسعير", desc: "إدارة، تعديل، إضافة قواعد التسعير" },
  { to: ROUTES.RFQ.LIST, icon: ClipboardList, label: "جميع طلبات العروض", desc: "عرض وإدارة كل طلبات العروض" },
  { to: ROUTES.QUOTES.LIST, icon: FileText, label: "كل عروض الأسعار", desc: "جميع عروض الأسعار في النظام" },
  { to: ROUTES.ADMIN.MONITOR, icon: Activity, label: "مراقبة النظام", desc: "حالة الخدمات وزمن الاستجابة" },
] as const;

export function AdminDashboardDesktop() {
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
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              لوحة التحكم — المشرف{user?.full_name ? ` (${user.full_name})` : ""}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              إحصائيات النظام، تكاليف الذكاء الاصطناعي، وقواعد التسعير النشطة.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
            <ShieldCheck className="h-4 w-4" />
            صلاحية كاملة
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard value={statsLoading ? "..." : (stats?.total_rfqs ?? 0)} label="إجمالي طلبات العروض" />
        <StatCard value={statsLoading ? "..." : (stats?.total_quotations ?? 0)} label="عروض الأسعار" />
        <StatCard value={statsLoading ? "..." : (stats?.total_users ?? 0)} label="المستخدمين" />
        <StatCard value={statsLoading ? "..." : (stats?.total_catalog_products ?? 0)} label="منتجات الكتالوج" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-slate-500" />
              <h2 className="text-base font-semibold text-slate-900">تكاليف الذكاء الاصطناعي</h2>
            </div>
            <button
              onClick={refreshAiCosts}
              className="rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-600 active:scale-[0.98]"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {aiCostsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          ) : aiCosts ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                <span className="text-sm text-slate-600">إجمالي التكلفة</span>
                <span className="text-lg font-bold text-slate-900 tabular-nums" dir="ltr">
                  ${parseFloat(aiCosts.total_cost || "0").toFixed(4)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                <span className="text-sm text-slate-600">عدد الاستدعاءات</span>
                <span className="text-lg font-bold text-slate-900 tabular-nums">
                  {aiCosts.total_calls ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                <span className="text-sm text-slate-600">آخر 24 ساعة</span>
                <span className="text-lg font-bold text-slate-900 tabular-nums" dir="ltr">
                  ${parseFloat(aiCosts.cost_last_24h || "0").toFixed(4)}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-slate-400">
              <AlertTriangle className="mx-auto h-6 w-6 text-amber-400" />
              <p className="mt-2">بيانات التكاليف غير متوفرة</p>
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">الإدارة السريعة</h2>
          </div>

          <div className="space-y-2.5">
            {QUICK_LINKS.map(({ to, icon: Icon, label, desc }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-3 text-start transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-start">
                    <p className="text-sm font-medium text-slate-900">{label}</p>
                    <p className="text-xs text-slate-500">{desc}</p>
                  </div>
                </div>
                <ChevronLeft className="h-4 w-4 text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">قواعد التسعير النشطة</h2>
          <button
            onClick={() => navigate(ROUTES.PRICING.RULES)}
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white transition-all duration-150 hover:bg-slate-900 active:scale-[0.98]"
          >
            إدارة القواعد
          </button>
        </div>

        {rulesLoading && (
          <div className="space-y-2 p-5">
            <Skeleton className="h-9 w-full rounded" />
            <Skeleton className="h-9 w-full rounded" />
            <Skeleton className="h-9 w-full rounded" />
          </div>
        )}

        {!rulesLoading && activeRules.length === 0 && (
          <div className="p-5">
            <EmptyState icon={Package} title="لا توجد قواعد تسعير نشطة" />
          </div>
        )}

        {!rulesLoading && activeRules.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-start">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500">الاسم</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500">التصنيف</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500">النوع</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500">القيمة</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500">الأولوية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeRules.slice(0, 10).map((rule) => (
                  <tr key={rule.id} className="transition-colors duration-150 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{rule.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{rule.category}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{rule.rule_type}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 tabular-nums">
                      {rule.rule_type === "percentage"
                        ? `${rule.value}%`
                        : `${rule.value} ${rule.currency || ""}`}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 tabular-nums">{rule.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
