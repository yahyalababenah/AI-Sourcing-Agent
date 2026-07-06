import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  RefreshCw,
  Server,
  Wifi,
  WifiOff,
  Zap,
  HardDrive,
  Cpu,
  GitBranch,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/ui/StatCard";
import { useAdminMonitorData } from "./useAdminMonitorData";
import { Sparkline, latencyColor, latencyBg, serviceStatusColor, systemStatusBadge } from "./monitorHelpers";

const SERVICE_ROWS = [
  { key: "database", label: "قاعدة البيانات", icon: Database },
  { key: "redis", label: "Redis", icon: Zap },
  { key: "minio", label: "MinIO", icon: HardDrive },
  { key: "celery", label: "Celery", icon: Cpu },
  { key: "llm", label: "LLM", icon: GitBranch },
] as const;

export function AdminMonitorPageDesktop() {
  const {
    health,
    healthLoading,
    stats,
    pings,
    pinging,
    lastRefresh,
    handleRefresh,
    services,
    isCircuitOpen,
    llmProviders,
    avgLatency,
    failedPings,
  } = useAdminMonitorData();

  const badge = systemStatusBadge(health?.status);

  return (
    <div className="space-y-5 pb-8">
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-white">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">مراقبة النظام</h1>
              <p className="text-sm text-slate-500">
                آخر تحديث: {lastRefresh.toLocaleTimeString("ar-SA-u-ca-gregory")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {health && (
              <span className={cn("rounded-full px-3 py-1 text-sm font-medium", badge.bg, badge.text)}>
                {badge.label}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={pinging}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-150 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", pinging && "animate-spin")} />
              تحديث الآن
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {SERVICE_ROWS.map(({ key, label, icon: Icon }) => {
          const val = services?.[key] ?? "—";
          const isOk = val === "connected" || val.startsWith("configured");
          const isWarn = val.startsWith("circuit_open") || val === "unknown";
          return (
            <div key={key} className="card p-4">
              <div className="flex items-center justify-between">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    isOk ? "bg-green-100 text-green-600" : isWarn ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-500"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                {healthLoading ? (
                  <div className="h-2 w-2 animate-pulse rounded-full bg-slate-300" />
                ) : isOk ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : isWarn ? (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-800">{label}</p>
              <p className={cn("mt-0.5 truncate text-xs", serviceStatusColor(val))}>{val}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard value={stats?.total_rfqs ?? "—"} label="طلبات الشراء" />
        <StatCard value={stats?.total_quotations ?? "—"} label="عروض الأسعار" />
        <StatCard value={stats?.total_users ?? "—"} label="المستخدمون" />
        <StatCard value={stats?.total_catalog_products ?? "—"} label="المنتجات" />
      </div>

      <div className="card">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">زمن استجابة نقاط النهاية</h2>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>
              متوسط: <span className={cn("font-semibold", latencyColor(avgLatency))}>{Math.round(avgLatency)}ms</span>
            </span>
            {failedPings > 0 && (
              <span className="flex items-center gap-1 text-red-500">
                <AlertTriangle className="h-4 w-4" />
                {failedPings} فشل
              </span>
            )}
          </div>
        </div>

        <div className="divide-y divide-slate-50">
          {pings.map((ping) => {
            const barWidth = ping.latency ? Math.min(100, (ping.latency / 1500) * 100) : 0;
            return (
              <div key={ping.endpoint} className="flex items-center gap-4 px-5 py-3">
                <div
                  className={cn(
                    "h-2.5 w-2.5 flex-shrink-0 rounded-full",
                    ping.latency === null ? "bg-slate-300" : ping.ok ? "bg-green-500" : "bg-red-500"
                  )}
                />
                <div className="w-36 flex-shrink-0">
                  <p className="text-sm font-medium text-slate-800">{ping.label}</p>
                  <p className="truncate text-xs text-slate-400">
                    {ping.method} {ping.endpoint}
                  </p>
                </div>
                <div className="flex-1">
                  <div className="h-2 w-full rounded-full bg-slate-100">
                    <div
                      className={cn("h-2 rounded-full transition-all duration-500", latencyBg(ping.latency))}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
                <div className="hidden w-20 sm:block">
                  <Sparkline data={ping.history} width={80} height={20} />
                </div>
                <div className="w-20 text-end">
                  {pinging && ping.latency === null ? (
                    <span className="text-xs text-slate-400">جاري...</span>
                  ) : ping.latency !== null ? (
                    <span className={cn("text-sm font-semibold tabular-nums", latencyColor(ping.latency))}>
                      {ping.latency}ms
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </div>
                <div className="w-12 text-center">
                  {ping.status !== null && (
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-xs font-medium",
                        ping.status < 400
                          ? "bg-green-100 text-green-700"
                          : ping.status < 500
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                      )}
                    >
                      {ping.status}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-5 border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" /> &lt;100ms ممتاز
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" /> 100-500ms مقبول
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" /> &gt;500ms بطيء
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">LLM Circuit Breakers</h2>
          </div>

          {llmProviders.length === 0 ? (
            <p className="text-sm text-slate-400">لا يوجد LLM provider مُهيأ</p>
          ) : (
            <div className="space-y-2">
              {llmProviders.map((provider) => (
                <div
                  key={provider}
                  className={cn("flex items-center justify-between rounded-lg p-3", isCircuitOpen ? "bg-amber-50" : "bg-green-50")}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("h-2.5 w-2.5 rounded-full", isCircuitOpen ? "bg-amber-500" : "bg-green-500")} />
                    <span className="text-sm font-medium capitalize text-slate-800">{provider}</span>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      isCircuitOpen ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                    )}
                  >
                    {isCircuitOpen ? "OPEN ⚠️" : "CLOSED ✓"}
                  </span>
                </div>
              ))}
              {isCircuitOpen && (
                <p className="mt-2 text-xs text-amber-600">
                  ⚠️ الـ circuit مفتوح — الطلبات ستُرفض حتى يُغلق تلقائياً بعد فترة التعافي.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Server className="h-5 w-5 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">معلومات البيئة</h2>
          </div>

          <div className="space-y-2">
            {[
              { label: "البيئة", value: health?.environment ?? "—" },
              {
                label: "الإصدار",
                value: health?.version ?? "—",
              },
              {
                label: "حالة النظام",
                value: health?.status ?? "—",
                color: health?.status === "ok" ? "text-green-600" : "text-amber-500",
              },
              { label: "نقاط نهاية تعمل", value: `${pings.filter((p) => p.ok).length} / ${pings.length}` },
              { label: "متوسط الـ latency", value: `${Math.round(avgLatency)}ms`, color: latencyColor(avgLatency) },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-sm text-slate-500">{label}</span>
                <span className={cn("text-sm font-semibold text-slate-800", color)}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {stats?.users_by_role && (
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-500" />
            <h2 className="text-base font-semibold text-slate-900">توزيع المستخدمين حسب الدور</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.users_by_role).map(([role, count]) => (
              <div key={role} className="flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-2">
                <span className="text-sm capitalize text-slate-500">{role}</span>
                <span className="text-lg font-bold text-slate-900">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
        <Wifi className="h-3.5 w-3.5" />
        <span>يتحدث تلقائياً كل 30 ثانية</span>
        <span>·</span>
        <span>آخر فحص: {lastRefresh.toLocaleTimeString("ar-SA-u-ca-gregory")}</span>
      </div>
    </div>
  );
}
