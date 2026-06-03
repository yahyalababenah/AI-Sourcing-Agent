import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { pricingService } from "@/services/pricingService";
import { ROUTES } from "@/constants/routes";
import {
  DollarSign,
  Users,
  Settings,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  FileText,
  ClipboardList,
  Package,
} from "lucide-react";

/**
 * Admin Dashboard (God Mode) — System-Wide Analytics & Management
 *
 * Admins can:
 * 1. View system-wide stats (total RFQs, quotes, users, documents)
 * 2. Monitor total AI costs from ai_cost_log
 * 3. View MinIO storage usage
 * 4. Manage users (list, activate/deactivate)
 * 5. Edit global pricing_rules (inline or quick-link)
 */
export function AdminDashboard() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  // ── System Stats ──
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      // We aggregate from existing APIs since there's no dedicated admin stats endpoint yet
      const [rfqsRes, quotesRes, rulesRes] = await Promise.allSettled([
        fetch("/api/v1/intake/rfqs?limit=1").then((r) => r.json()),
        fetch("/api/v1/quotes?limit=1").then((r) => r.json()),
        pricingService.listRules({}),
      ]);

      const totalRfqs =
        rfqsRes.status === "fulfilled" ? rfqsRes.value?.total ?? 0 : 0;
      const totalQuotes =
        quotesRes.status === "fulfilled" ? quotesRes.value?.total ?? 0 : 0;
      const totalRules = rulesRes.status === "fulfilled" ? rulesRes.value?.total ?? 0 : 0;

      return { totalRfqs, totalQuotes, totalRules };
    },
    staleTime: 30_000,
  });

  // ── AI Cost Stats ──
  const { data: aiCosts, isLoading: aiCostsLoading } = useQuery({
    queryKey: ["admin", "ai-costs"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/v1/admin/ai-costs");
        if (!res.ok) throw new Error("Not available");
        return await res.json();
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  // ── Pricing Rules Preview ──
  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: ["admin", "pricing-rules-preview"],
    queryFn: () => pricingService.listRules({ active_only: true }),
    staleTime: 30_000,
  });

  const queryClient = useQueryClient();

  const activeRules = rulesData?.items ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              لوحة التحكم — المشرف {user?.full_name ? `(${user.full_name})` : ""} 🛡️
            </h1>
            <p className="mt-1 text-gray-600">
              إدارة شاملة للنظام: إحصائيات، تكاليف الذكاء الاصطناعي، المستخدمين، وقواعد التسعير.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-purple-100 px-4 py-2 text-sm font-medium text-purple-700">
            <Shield className="h-4 w-4" />
            صلاحية كاملة (God Mode)
          </div>
        </div>
      </div>

      {/* ── System-Wide Stats Grid ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">إجمالي طلبات العروض</p>
              <p className="text-2xl font-bold text-gray-900">
                {statsLoading ? "..." : (stats?.totalRfqs ?? 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">عروض الأسعار</p>
              <p className="text-2xl font-bold text-gray-900">
                {statsLoading ? "..." : (stats?.totalQuotes ?? 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">المستخدمين</p>
              <p className="text-2xl font-bold text-gray-900">—</p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">قواعد التسعير</p>
              <p className="text-2xl font-bold text-gray-900">
                {rulesLoading ? "..." : activeRules.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── AI Costs & Storage + Pricing Rules ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* AI Cost Monitoring */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900">تكاليف الذكاء الاصطناعي</h2>
            </div>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ["admin", "ai-costs"] })}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {aiCostsLoading ? (
            <div className="py-6 text-center text-sm text-gray-400">جاري التحميل...</div>
          ) : aiCosts ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <span className="text-sm text-gray-600">إجمالي التكلفة</span>
                <span className="text-lg font-bold text-gray-900">
                  ${parseFloat(aiCosts.total_cost || "0").toFixed(4)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <span className="text-sm text-gray-600">عدد الاستدعاءات</span>
                <span className="text-lg font-bold text-gray-900">
                  {aiCosts.total_calls ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <span className="text-sm text-gray-600">آخر 24 ساعة</span>
                <span className="text-lg font-bold text-gray-900">
                  ${parseFloat(aiCosts.cost_last_24h || "0").toFixed(4)}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-gray-400">
              <AlertTriangle className="mx-auto h-6 w-6 text-amber-400" />
              <p className="mt-2">بيانات التكاليف غير متوفرة</p>
              <p className="text-xs text-gray-400">قم بإضافة نقطة نهاية /api/v1/admin/ai-costs</p>
            </div>
          )}
        </div>

        {/* Quick Management Links */}
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">الإدارة السريعة</h2>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate(ROUTES.PRICING.RULES)}
              className="flex w-full items-center justify-between rounded-lg border border-gray-200 p-3 text-right transition-colors hover:border-primary-300 hover:bg-primary-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                  <Settings className="h-4 w-4" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">قواعد التسعير</p>
                  <p className="text-xs text-gray-500">
                    {activeRules.length} قاعدة نشطة — إدارة، تعديل، إضافة
                  </p>
                </div>
              </div>
              <TrendingUp className="h-4 w-4 text-gray-400" />
            </button>

            <button
              onClick={() => navigate(ROUTES.RFQ.LIST)}
              className="flex w-full items-center justify-between rounded-lg border border-gray-200 p-3 text-right transition-colors hover:border-primary-300 hover:bg-primary-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <ClipboardList className="h-4 w-4" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">جميع طلبات العروض</p>
                  <p className="text-xs text-gray-500">عرض وإدارة جميع طلبات العروض</p>
                </div>
              </div>
              <TrendingUp className="h-4 w-4 text-gray-400" />
            </button>

            <button
              onClick={() => navigate(ROUTES.QUOTES.LIST)}
              className="flex w-full items-center justify-between rounded-lg border border-gray-200 p-3 text-right transition-colors hover:border-primary-300 hover:bg-primary-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-700">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">عروض الأسعار</p>
                  <p className="text-xs text-gray-500">جميع عروض الأسعار في النظام</p>
                </div>
              </div>
              <TrendingUp className="h-4 w-4 text-gray-400" />
            </button>

            <button
              onClick={() => navigate(ROUTES.SETTINGS)}
              className="flex w-full items-center justify-between rounded-lg border border-gray-200 p-3 text-right transition-colors hover:border-primary-300 hover:bg-primary-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                  <Users className="h-4 w-4" />
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">إدارة المستخدمين</p>
                  <p className="text-xs text-gray-500">إدارة حسابات المستخدمين والصلاحيات</p>
                </div>
              </div>
              <TrendingUp className="h-4 w-4 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Active Pricing Rules Table ── */}
      <div className="card">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">قواعد التسعير النشطة</h2>
          <button
            onClick={() => navigate(ROUTES.PRICING.RULES)}
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-700"
          >
            إدارة القواعد
          </button>
        </div>

        {rulesLoading && (
          <div className="p-6 text-center text-sm text-gray-400">جاري التحميل...</div>
        )}

        {!rulesLoading && activeRules.length === 0 && (
          <div className="p-6 text-center text-sm text-gray-400">
            <Package className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2">لا توجد قواعد تسعير نشطة</p>
          </div>
        )}

        {activeRules.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">الاسم</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">التصنيف</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">النوع</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">القيمة</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">الأولوية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeRules.slice(0, 10).map((rule) => (
                  <tr key={rule.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{rule.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{rule.category}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{rule.rule_type}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {rule.rule_type === "percentage"
                        ? `${rule.value}%`
                        : `${rule.value} ${rule.currency || ""}`}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{rule.priority}</td>
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

/** Simple shield icon since lucide doesn't export it directly */
function Shield({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
