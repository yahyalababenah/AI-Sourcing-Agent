import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { ROUTES } from "@/constants/routes";
import { useAgentDashboardData, type AgentRfqStatus } from "./useAgentDashboardData";
import type { Product, RFQ } from "@/types/intake";

// Straight carry-over of the pre-split AgentDashboard implementation — kept
// as-is (legacy CSS-variable theme included) so small viewports don't break
// while this file waits for its real rebuild in T3.2.

// ── tiny helpers ──────────────────────────────────────────────────────────────

function useCountdown(targetMs: number | null) {
  const [remaining, setRemaining] = useState(() => (targetMs ? Math.max(0, targetMs - Date.now()) : 0));
  useEffect(() => {
    if (!targetMs) return;
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1000)), 1000);
    return () => clearInterval(id);
  }, [targetMs]);
  if (!targetMs) return null;
  const h = String(Math.floor(remaining / 3_600_000)).padStart(2, "0");
  const m = String(Math.floor((remaining % 3_600_000) / 60_000)).padStart(2, "0");
  const s = String(Math.floor((remaining % 60_000) / 1000)).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function todayArabic() {
  return new Date().toLocaleDateString("ar-JO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const STATUS_AR: Record<AgentRfqStatus, string> = {
  open: "قيد الانتظار",
  processing: "تحت المراجعة",
  quoted: "جارٍ التفاوض",
  closed: "مكتمل",
};

const COL_COLORS: Record<AgentRfqStatus, string> = {
  open: "#7a91a8",
  processing: "#4a7ab8",
  quoted: "#d97706",
  closed: "#0F6E56",
};

// ── Kanban Card ───────────────────────────────────────────────────────────────

function KanbanCard({
  rfq,
  products,
  onClick,
}: {
  rfq: RFQ;
  products: Product[];
  onClick: () => void;
}) {
  const deadlineMs = rfq.exclusive_deadline ? new Date(rfq.exclusive_deadline).getTime() : null;
  const isUrgent = !!deadlineMs && deadlineMs > Date.now();
  const countdown = useCountdown(isUrgent ? deadlineMs : null);

  const quantity = products.reduce((sum, p) => sum + (p.quantity ?? 0), 0);
  const estimatedValue = products.reduce(
    (sum, p) => sum + (p.quantity ?? 0) * (p.target_price ?? 0),
    0
  );

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
          {rfq.client_request_arabic?.split("\n")[0]?.replace("المنتج: ", "") || "طلب توريد"}
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
          {estimatedValue > 0
            ? `${rfq.target_currency ?? "JOD"} ${Math.round(estimatedValue).toLocaleString()}`
            : "—"}
        </span>
        {quantity > 0 && (
          <div
            className="text-[9px] px-1.5 py-0.5 rounded"
            style={{
              background: isUrgent ? "var(--amber-surface)" : "var(--surface-3)",
              color: isUrgent ? "#d97706" : "var(--text-4)",
            }}
          >
            {quantity.toLocaleString()} وحدة
          </div>
        )}
      </div>
    </div>
  );
}

// ── Column ────────────────────────────────────────────────────────────────────

function KanbanColumn({
  status,
  rfqs,
  productsMap,
  onCardClick,
}: {
  status: AgentRfqStatus;
  rfqs: RFQ[];
  productsMap: Record<string, Product[]>;
  onCardClick: (rfq: RFQ) => void;
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
          <KanbanCard
            key={rfq.id}
            rfq={rfq}
            products={productsMap[rfq.id] ?? []}
            onClick={() => onCardClick(rfq)}
          />
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

export function AgentDashboardMobile() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { columns, productsMap, stats } = useAgentDashboardData();

  return (
    <div className="flex flex-col h-full" dir="rtl" style={{ color: "var(--text-1)" }}>
      {/* Page header */}
      <div
        className="flex flex-col gap-3 px-4 py-4 mb-4 rounded-lg sm:flex-row sm:items-center sm:justify-between sm:px-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div>
          <h1 className="text-[18px] font-bold" style={{ color: "var(--text-1)" }}>إدارة الطلبات</h1>
          <p className="text-[11px]" style={{ color: "var(--text-2)" }}>
            {todayArabic()} — مرحباً {user?.full_name}
          </p>
        </div>
        <button
          onClick={() => navigate(ROUTES.RFQ.CREATE)}
          className="w-full px-4 py-2.5 text-[13px] font-bold text-white rounded-lg transition-all bg-supplier-500 hover:bg-supplier-600 sm:w-auto sm:text-[12px] sm:py-2"
        >
          + طلب جديد
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 mb-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg p-4"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="text-[11px] mb-1" style={{ color: "var(--text-2)" }}>{s.label}</div>
            <div
              className="text-[26px] font-black leading-none font-mono"
              style={{ color: s.accent ? "#10B981" : "var(--text-1)", fontVariantNumeric: "tabular-nums" }}
              dir="ltr"
            >
              {typeof s.value === "string" ? <span className="text-[22px]">{s.value}</span> : s.value}
            </div>
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
              productsMap={productsMap}
              onCardClick={(rfq) => navigate(ROUTES.RFQ.DETAIL(rfq.id))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
