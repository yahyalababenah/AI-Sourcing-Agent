import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { intakeService } from "@/services/intakeService";
import { ROUTES } from "@/constants/routes";

// ── tiny helpers ──────────────────────────────────────────────────────────────

function useCountdown(targetMs: number) {
  const [remaining, setRemaining] = useState(() => Math.max(0, targetMs - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1000)), 1000);
    return () => clearInterval(id);
  }, [targetMs]);
  const h = String(Math.floor(remaining / 3_600_000)).padStart(2, "0");
  const m = String(Math.floor((remaining % 3_600_000) / 60_000)).padStart(2, "0");
  const s = String(Math.floor((remaining % 60_000) / 1000)).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

const STATUS_AR: Record<string, string> = {
  open:        "قيد الانتظار",
  processing:  "تحت المراجعة",
  quoted:      "جارٍ التفاوض",
  closed:      "مكتمل",
  cancelled:   "ملغي",
};

const COL_COLORS: Record<string, string> = {
  open:        "#7a91a8",
  processing:  "#4a7ab8",
  quoted:      "#d97706",
  closed:      "#059669",
};

// ── Kanban Card ───────────────────────────────────────────────────────────────

function KanbanCard({ rfq, onClick }: { rfq: any; onClick: () => void }) {
  const isUrgent = rfq.status === "quoted";
  const deadlineMs = Date.now() + 5.8 * 3_600_000;
  const countdown = useCountdown(isUrgent ? deadlineMs : Date.now() + 31 * 3_600_000);
  const amount = rfq.amount ?? (Math.floor(Math.random() * 40000) + 5000);

  return (
    <div
      onClick={onClick}
      className="rounded-lg p-3 cursor-pointer transition-all hover:-translate-y-[1px]"
      style={{
        background: "var(--surface-2)",
        border: isUrgent ? "1px solid var(--amber-border)" : "1px solid var(--border)",
        borderRight: isUrgent ? "3px solid #d97706" : undefined,
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="text-[12px] font-bold" style={{ color: "var(--text-dim)" }}>
          {rfq.client_request_arabic?.split("\n")[0]?.replace("المنتج: ", "") || rfq.product_name || "طلب توريد"}
        </div>
        {isUrgent && (
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "#d97706", animation: "dotPulse 1.2s ease infinite" }}
          />
        )}
      </div>
      <div className="text-[10px] mb-2" style={{ color: "var(--text-2)" }}>
        {rfq.client_name || "العميل"}
      </div>

      {isUrgent && (
        <div
          className="rounded-md px-2.5 py-1.5 mb-2 flex items-center justify-between"
          style={{ background: "var(--amber-surface-2)", border: "1px solid var(--amber-surface)" }}
        >
          <span className="text-[10px]" style={{ color: "#d97706" }}>ينتهي خلال</span>
          <span
            className="text-[17px] font-black font-mono"
            style={{ color: "#d97706", fontVariantNumeric: "tabular-nums" }}
            dir="ltr"
          >
            {countdown}
          </span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <span
          className="text-[11px] font-bold font-mono"
          style={{ color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }}
          dir="ltr"
        >
          ${amount.toLocaleString()}
        </span>
        <div
          className="text-[9px] px-1.5 py-0.5 rounded"
          style={{
            background: isUrgent ? "var(--amber-surface)" : "var(--surface-3)",
            color: isUrgent ? "#d97706" : "var(--text-4)",
          }}
        >
          {Math.floor(Math.random() * 900 + 100)} وحدة
        </div>
      </div>
    </div>
  );
}

// ── Column ────────────────────────────────────────────────────────────────────

function KanbanColumn({
  status,
  rfqs,
  onCardClick,
}: {
  status: string;
  rfqs: any[];
  onCardClick: (rfq: any) => void;
}) {
  const color = COL_COLORS[status] ?? "#7a91a8";
  const isDone = status === "closed";

  return (
    <div className="flex-1 flex flex-col min-w-0" style={{ opacity: isDone ? 0.55 : 1 }}>
      <div className="flex items-center gap-2 py-2.5 mb-2" dir="rtl">
        <div className="w-2 h-2 rounded-sm" style={{ background: color }} />
        <span className="text-[12px] font-bold" style={{ color }}>
          {STATUS_AR[status]}
        </span>
        <div className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: "var(--surface-3)", color: "var(--text-2)" }}>
          {rfqs.length}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {rfqs.map((rfq) => (
          <KanbanCard key={rfq.id} rfq={rfq} onClick={() => onCardClick(rfq)} />
        ))}
        {rfqs.length === 0 && (
          <div
            className="rounded-lg p-4 text-center text-[11px]"
            style={{ border: "1px dashed var(--border)", color: "var(--text-3)" }}
          >
            لا توجد طلبات
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AgentDashboard() {
  const user     = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const { data: allRfqs } = useQuery({
    queryKey: ["agent-all-rfqs"],
    queryFn:  () => intakeService.list({ limit: 50 }),
    staleTime: 15_000,
  });

  const { data: openStats }   = useQuery({ queryKey: ["rfqs-open"],   queryFn: () => intakeService.list({ status: "open",   limit: 1 }), staleTime: 30_000 });
  const { data: quotedStats } = useQuery({ queryKey: ["rfqs-quoted"], queryFn: () => intakeService.list({ status: "quoted", limit: 1 }), staleTime: 30_000 });
  const { data: closedStats } = useQuery({ queryKey: ["rfqs-closed"], queryFn: () => intakeService.list({ status: "closed", limit: 1 }), staleTime: 30_000 });

  const items = allRfqs?.items ?? [];

  const columns = {
    open:       items.filter((r) => r.status === "open").slice(0, 4),
    processing: items.filter((r) => r.status === "processing").slice(0, 4),
    quoted:     items.filter((r) => r.status === "quoted").slice(0, 4),
    closed:     items.filter((r) => r.status === "closed" || r.status === "cancelled").slice(0, 2),
  };

  const stats = [
    { label: "طلبات نشطة",       value: openStats?.total   ?? 0, color: "var(--text-1)", sub: "↑ 3 هذا الأسبوع",    subColor: "#059669" },
    { label: "في انتظار العرض",  value: quotedStats?.total ?? 0, color: "#d97706",         sub: "نافذة نشطة",          subColor: "#d97706"  },
    { label: "مكتملة الأسبوع",   value: closedStats?.total ?? 0, color: "var(--text-1)", sub: "↑ 23% نمو",            subColor: "#059669" },
    { label: "إيرادات الشهر",    value: null,                     color: "#10b981",         sub: "↑ 18% عن الماضي",     subColor: "#059669" },
  ];

  return (
    <div className="flex flex-col h-full" dir="rtl" style={{ color: "var(--text-1)" }}>
      {/* Page header */}
      <div
        className="flex items-center justify-between px-6 py-4 mb-4 rounded-lg"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div>
          <h1 className="text-[18px] font-bold" style={{ color: "var(--text-1)" }}>خط الأنابيب</h1>
          <p className="text-[11px]" style={{ color: "var(--text-2)" }}>
            الإثنين، 30 يونيو 2025 — مرحباً {user?.full_name}
          </p>
        </div>
        <button
          onClick={() => navigate(ROUTES.RFQ.CREATE)}
          className="px-4 py-2 text-[12px] font-bold text-white rounded-lg transition-all hover:brightness-110"
          style={{ background: "#059669" }}
        >
          + طلب جديد
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg p-4"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="text-[11px] mb-1" style={{ color: "var(--text-2)" }}>{s.label}</div>
            <div
              className="text-[26px] font-black leading-none font-mono"
              style={{ color: s.color, fontVariantNumeric: "tabular-nums" }}
              dir="ltr"
            >
              {s.value !== null
                ? s.value
                : <span className="text-[22px]">JD 24,580</span>}
            </div>
            <div className="text-[10px] mt-1" style={{ color: s.subColor }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Kanban board */}
      <div
        className="flex-1 overflow-hidden rounded-lg p-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex gap-4 h-full overflow-x-auto">
          {(["open", "processing", "quoted", "closed"] as const).map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              rfqs={columns[status]}
              onCardClick={(rfq) => navigate(ROUTES.RFQ.DETAIL(rfq.id))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
