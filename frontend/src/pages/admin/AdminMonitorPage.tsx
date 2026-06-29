import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
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
  FileText,
  ClipboardList,
  Package,
} from "lucide-react";
import { monitoringService } from "@/services/monitoringService";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface HealthData {
  status: "ok" | "degraded" | "unhealthy";
  version: string;
  environment: string;
  services: {
    database: string;
    redis: string;
    minio: string;
    celery: string;
    llm: string;
  };
}

interface PingResult {
  label: string;
  endpoint: string;
  method: string;
  latency: number | null;
  status: number | null;
  ok: boolean;
  history: number[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL = 30_000; // 30s
const MAX_HISTORY = 12;

const ENDPOINTS_TO_PING: Array<{
  label: string;
  endpoint: string;
  method: "GET" | "POST";
  body?: object;
}> = [
  { label: "Health Check", endpoint: "/health", method: "GET" },
  { label: "Auth / Me", endpoint: "/api/v1/auth/me", method: "GET" },
  { label: "RFQs List", endpoint: "/api/v1/intake/rfqs", method: "GET" },
  { label: "Pricing Rules", endpoint: "/api/v1/pricing/rules", method: "GET" },
  { label: "Quotes List", endpoint: "/api/v1/quotes", method: "GET" },
  { label: "Chat Rooms", endpoint: "/api/v1/chat/rooms", method: "GET" },
  { label: "Catalog Products", endpoint: "/api/v1/catalog/products", method: "GET" },
  { label: "Admin Stats", endpoint: "/api/v1/admin/stats", method: "GET" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function latencyColor(ms: number | null): string {
  if (ms === null) return "text-gray-400";
  if (ms < 100) return "text-green-600";
  if (ms < 500) return "text-amber-500";
  return "text-red-500";
}

function latencyBg(ms: number | null): string {
  if (ms === null) return "bg-gray-200";
  if (ms < 100) return "bg-green-500";
  if (ms < 500) return "bg-amber-400";
  return "bg-red-500";
}

function serviceStatusColor(status: string): string {
  if (status === "connected" || status.startsWith("configured")) return "text-green-600";
  if (status.startsWith("circuit_open")) return "text-amber-500";
  return "text-red-500";
}

function systemStatusBadge(status: "ok" | "degraded" | "unhealthy" | undefined) {
  if (status === "ok") return { bg: "bg-green-100", text: "text-green-700", label: "يعمل بشكل طبيعي" };
  if (status === "degraded") return { bg: "bg-amber-100", text: "text-amber-700", label: "أداء متدهور" };
  return { bg: "bg-red-100", text: "text-red-700", label: "غير متاح" };
}

// Mini SVG sparkline from an array of latency values
function Sparkline({ data, width = 80, height = 24 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return <span className="text-xs text-gray-300">—</span>;
  const max = Math.max(...data, 1);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (v / max) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const fill = data[data.length - 1] < 500 ? "#10b981" : data[data.length - 1] < 1000 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={width} height={height} className="inline-block align-middle">
      <polyline points={pts} fill="none" stroke={fill} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AdminMonitorPage() {
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [pings, setPings] = useState<PingResult[]>(() =>
    ENDPOINTS_TO_PING.map((ep) => ({
      ...ep,
      latency: null,
      status: null,
      ok: false,
      history: [],
    }))
  );
  const [pinging, setPinging] = useState(false);
  const pingRef = useRef(false);

  // ── Health endpoint ──────────────────────────────────────────────────────
  const {
    data: health,
    isLoading: healthLoading,
    refetch: refetchHealth,
  } = useQuery<HealthData>({
    queryKey: ["monitor", "health"],
    queryFn: async () => {
      const r = await fetch("/health");
      return r.json();
    },
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 10_000,
  });

  // ── System stats ─────────────────────────────────────────────────────────
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["monitor", "stats"],
    queryFn: () => monitoringService.getStats(),
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 20_000,
    retry: false,
  });

  // ── Ping all endpoints ───────────────────────────────────────────────────
  const runPings = useCallback(async () => {
    if (pingRef.current) return;
    pingRef.current = true;
    setPinging(true);

    const results = await Promise.all(
      ENDPOINTS_TO_PING.map(async (ep, idx) => {
        const t0 = performance.now();
        let latency: number | null = null;
        let status: number | null = null;
        let ok = false;
        try {
          const res = await fetch(ep.endpoint, {
            method: ep.method,
            headers: {
              Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}`,
              "Content-Type": "application/json",
            },
            signal: AbortSignal.timeout(8000),
          });
          latency = Math.round(performance.now() - t0);
          status = res.status;
          ok = res.status < 500;
        } catch {
          latency = null;
          status = null;
          ok = false;
        }

        return { idx, latency, status, ok };
      })
    );

    setPings((prev) =>
      prev.map((p, idx) => {
        const r = results.find((x) => x.idx === idx);
        if (!r) return p;
        const newHistory = [
          ...p.history.slice(-(MAX_HISTORY - 1)),
          r.latency ?? 0,
        ];
        return { ...p, latency: r.latency, status: r.status, ok: r.ok, history: newHistory };
      })
    );

    setPinging(false);
    pingRef.current = false;
    setLastRefresh(new Date());
  }, []);

  // Initial ping + interval
  useEffect(() => {
    runPings();
    const id = setInterval(runPings, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [runPings]);

  const handleRefresh = () => {
    refetchHealth();
    refetchStats();
    runPings();
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const badge = systemStatusBadge(health?.status);
  const services = health?.services;
  const llmStatus = services?.llm ?? "";
  const isCircuitOpen = llmStatus.startsWith("circuit_open");
  const llmProviders = llmStatus.replace(/^(configured|circuit_open):/, "").split(",").filter(Boolean);

  const avgLatency =
    pings.filter((p) => p.latency !== null).reduce((a, p) => a + (p.latency ?? 0), 0) /
    Math.max(1, pings.filter((p) => p.latency !== null).length);

  const failedPings = pings.filter((p) => !p.ok && p.status !== null).length;

  return (
    <div className="space-y-5 pb-8" dir="rtl">
      {/* ── Header ── */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">مراقبة النظام</h1>
              <p className="text-sm text-gray-500">
                آخر تحديث:{" "}
                {lastRefresh.toLocaleTimeString("ar-SA-u-ca-gregory")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Overall status badge */}
            {health && (
              <span className={cn("rounded-full px-3 py-1 text-sm font-medium", badge.bg, badge.text)}>
                {badge.label}
              </span>
            )}

            <button
              onClick={handleRefresh}
              disabled={pinging}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", pinging && "animate-spin")} />
              تحديث الآن
            </button>
          </div>
        </div>
      </div>

      {/* ── Services Health ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { key: "database", label: "قاعدة البيانات", icon: Database },
          { key: "redis", label: "Redis", icon: Zap },
          { key: "minio", label: "MinIO", icon: HardDrive },
          { key: "celery", label: "Celery", icon: Cpu },
          { key: "llm", label: "LLM", icon: GitBranch },
        ].map(({ key, label, icon: Icon }) => {
          const val = services?.[key as keyof typeof services] ?? "—";
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
                  <div className="h-2 w-2 animate-pulse rounded-full bg-gray-300" />
                ) : isOk ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : isWarn ? (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-800">{label}</p>
              <p className={cn("mt-0.5 text-xs truncate", serviceStatusColor(val))}>{val}</p>
            </div>
          );
        })}
      </div>

      {/* ── Quick Stats Row ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "طلبات الشراء", value: stats?.total_rfqs, icon: ClipboardList, color: "blue" },
          { label: "عروض الأسعار", value: stats?.total_quotations, icon: FileText, color: "green" },
          { label: "المستخدمون", value: stats?.total_users, icon: Users, color: "purple" },
          { label: "المنتجات", value: stats?.total_catalog_products, icon: Package, color: "teal" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-${color}-100 text-${color}-600`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-xl font-bold text-gray-900">
                  {value ?? <span className="text-gray-300">—</span>}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Endpoint Latency Table ── */}
      <div className="card">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">زمن استجابة نقاط النهاية</h2>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>
              متوسط:{" "}
              <span className={cn("font-semibold", latencyColor(avgLatency))}>
                {Math.round(avgLatency)}ms
              </span>
            </span>
            {failedPings > 0 && (
              <span className="flex items-center gap-1 text-red-500">
                <AlertTriangle className="h-4 w-4" />
                {failedPings} فشل
              </span>
            )}
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {pings.map((ping) => {
            const barWidth = ping.latency ? Math.min(100, (ping.latency / 1500) * 100) : 0;
            return (
              <div key={ping.endpoint} className="flex items-center gap-4 px-5 py-3">
                {/* Status dot */}
                <div
                  className={cn(
                    "h-2.5 w-2.5 flex-shrink-0 rounded-full",
                    ping.latency === null ? "bg-gray-300" :
                    ping.ok ? "bg-green-500" : "bg-red-500"
                  )}
                />

                {/* Label + endpoint */}
                <div className="w-36 flex-shrink-0">
                  <p className="text-sm font-medium text-gray-800">{ping.label}</p>
                  <p className="truncate text-xs text-gray-400">{ping.method} {ping.endpoint}</p>
                </div>

                {/* Bar */}
                <div className="flex-1">
                  <div className="h-2 w-full rounded-full bg-gray-100">
                    <div
                      className={cn("h-2 rounded-full transition-all duration-500", latencyBg(ping.latency))}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>

                {/* Sparkline */}
                <div className="hidden w-20 sm:block">
                  <Sparkline data={ping.history} width={80} height={20} />
                </div>

                {/* Latency value */}
                <div className="w-20 text-right">
                  {pinging && ping.latency === null ? (
                    <span className="text-xs text-gray-400">جاري...</span>
                  ) : ping.latency !== null ? (
                    <span className={cn("text-sm font-semibold tabular-nums", latencyColor(ping.latency))}>
                      {ping.latency}ms
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </div>

                {/* HTTP status */}
                <div className="w-12 text-center">
                  {ping.status !== null && (
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-xs font-medium",
                        ping.status < 400 ? "bg-green-100 text-green-700" :
                        ping.status < 500 ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
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

        {/* Legend */}
        <div className="flex items-center gap-5 border-t border-gray-100 px-5 py-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-green-500" /> &lt;100ms ممتاز</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-400" /> 100-500ms مقبول</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-500" /> &gt;500ms بطيء</span>
        </div>
      </div>

      {/* ── LLM Circuit Breakers + Environment ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Circuit breakers */}
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">LLM Circuit Breakers</h2>
          </div>

          {llmProviders.length === 0 ? (
            <p className="text-sm text-gray-400">لا يوجد LLM provider مُهيأ</p>
          ) : (
            <div className="space-y-2">
              {llmProviders.map((provider) => {
                const open = isCircuitOpen;
                return (
                  <div
                    key={provider}
                    className={cn(
                      "flex items-center justify-between rounded-lg p-3",
                      open ? "bg-amber-50" : "bg-green-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("h-2.5 w-2.5 rounded-full", open ? "bg-amber-500" : "bg-green-500")} />
                      <span className="text-sm font-medium text-gray-800 capitalize">{provider}</span>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        open ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                      )}
                    >
                      {open ? "OPEN ⚠️" : "CLOSED ✓"}
                    </span>
                  </div>
                );
              })}
              {isCircuitOpen && (
                <p className="mt-2 text-xs text-amber-600">
                  ⚠️ الـ circuit مفتوح — الطلبات ستُرفض حتى يُغلق تلقائياً بعد فترة التعافي.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Environment info */}
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Server className="h-5 w-5 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">معلومات البيئة</h2>
          </div>

          <div className="space-y-2">
            {[
              { label: "البيئة", value: health?.environment ?? "—" },
              { label: "الإصدار", value: health?.version ?? "—" },
              {
                label: "حالة النظام",
                value: health?.status ?? "—",
                color: health?.status === "ok" ? "text-green-600" : "text-amber-500",
              },
              {
                label: "نقاط نهاية تعمل",
                value: `${pings.filter((p) => p.ok).length} / ${pings.length}`,
              },
              {
                label: "متوسط الـ latency",
                value: `${Math.round(avgLatency)}ms`,
                color: latencyColor(avgLatency),
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-sm text-gray-500">{label}</span>
                <span className={cn("text-sm font-semibold text-gray-800", color)}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Users by Role ── */}
      {stats?.users_by_role && (
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">توزيع المستخدمين حسب الدور</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.users_by_role).map(([role, count]) => (
              <div key={role} className="flex items-center gap-2 rounded-lg bg-gray-50 px-4 py-2">
                <span className="text-sm text-gray-500 capitalize">{role}</span>
                <span className="text-lg font-bold text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Connection status footer ── */}
      <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
        <Wifi className="h-3.5 w-3.5" />
        <span>يتحدث تلقائياً كل 30 ثانية</span>
        <span>·</span>
        <span>آخر فحص: {lastRefresh.toLocaleTimeString("ar-SA-u-ca-gregory")}</span>
      </div>
    </div>
  );
}
