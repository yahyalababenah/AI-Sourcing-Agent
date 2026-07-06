// Shared helpers/atoms for AdminMonitorPageDesktop/Mobile — status/latency
// are semantic monitoring signals (health/speed), not decorative brand
// colors, so green/amber/red stay per CLAUDE.md's existing precedent
// (StatusPill, ElapsedTimeBadge use the same red/amber/slate logic).

export function latencyColor(ms: number | null): string {
  if (ms === null) return "text-slate-400";
  if (ms < 100) return "text-green-600";
  if (ms < 500) return "text-amber-500";
  return "text-red-500";
}

export function latencyBg(ms: number | null): string {
  if (ms === null) return "bg-slate-200";
  if (ms < 100) return "bg-green-500";
  if (ms < 500) return "bg-amber-400";
  return "bg-red-500";
}

export function serviceStatusColor(status: string): string {
  if (status === "connected" || status.startsWith("configured")) return "text-green-600";
  if (status.startsWith("circuit_open")) return "text-amber-500";
  return "text-red-500";
}

export function systemStatusBadge(status: "ok" | "degraded" | "unhealthy" | undefined) {
  if (status === "ok") return { bg: "bg-green-100", text: "text-green-700", label: "يعمل بشكل طبيعي" };
  if (status === "degraded") return { bg: "bg-amber-100", text: "text-amber-700", label: "أداء متدهور" };
  return { bg: "bg-red-100", text: "text-red-700", label: "غير متاح" };
}

// Mini SVG sparkline from an array of latency values.
export function Sparkline({ data, width = 80, height = 24 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return <span className="text-xs text-slate-300">—</span>;
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
