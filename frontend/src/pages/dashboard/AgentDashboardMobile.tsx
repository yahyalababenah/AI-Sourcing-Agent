import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Clock, Video } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { catalogService } from "@/services/catalogService";
import { ROUTES } from "@/constants/routes";
import { StatCard } from "@/components/ui/StatCard";
import { StatusPill, type OrderStatus } from "@/components/ui/StatusPill";
import { ReelTile } from "@/components/ui/ReelTile";
import { useAgentDashboardData, type AgentRfqStatus } from "./useAgentDashboardData";
import type { Product, RFQ } from "@/types/intake";

// Reference: handoff-designs/supplier-home-mobile.html

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

const formatPrice = (price: number | null) => (price == null ? "—" : `¥${price.toLocaleString()}`);

// Same mapping as AgentDashboardDesktop — RFQ statuses line up 1:1 with
// StatusPill's four CLAUDE.md labels.
const STATUS_PILL: Record<AgentRfqStatus, OrderStatus> = {
  open: "pending",
  processing: "under_review",
  quoted: "negotiating",
  closed: "completed",
};

const COL_ORDER: AgentRfqStatus[] = ["open", "processing", "quoted", "closed"];

function KanbanCard({ rfq, products, onClick }: { rfq: RFQ; products: Product[]; onClick: () => void }) {
  const deadlineMs = rfq.exclusive_deadline ? new Date(rfq.exclusive_deadline).getTime() : null;
  const isUrgent = !!deadlineMs && deadlineMs > Date.now();
  const countdown = useCountdown(isUrgent ? deadlineMs : null);

  const quantity = products.reduce((sum, p) => sum + (p.quantity ?? 0), 0);
  const estimatedValue = products.reduce((sum, p) => sum + (p.quantity ?? 0) * (p.target_price ?? 0), 0);

  return (
    <div
      onClick={onClick}
      className={`w-[150px] shrink-0 rounded-lg border p-3 cursor-pointer transition-all duration-150 active:scale-[0.98] ${
        isUrgent ? "border-amber-200 bg-amber-50/40 border-e-4 border-e-amber-500" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="text-[12px] font-bold text-slate-700">
          {rfq.client_request_arabic?.split("\n")[0]?.replace("المنتج: ", "") || "طلب توريد"}
        </div>
        {isUrgent && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
      </div>
      <div className="text-[10px] mb-2 text-slate-400">{rfq.client_name || "العميل"}</div>

      {isUrgent && (
        <div className="rounded-md border border-amber-200 bg-amber-100 px-2.5 py-1.5 mb-2 flex items-center justify-between">
          <span className="text-[10px] text-amber-700">ينتهي خلال</span>
          <span className="text-[15px] font-black font-mono text-amber-700 tabular-nums" dir="ltr">
            {countdown}
          </span>
        </div>
      )}

      <div className="flex justify-between items-center">
        <span className="text-[11px] font-bold font-mono text-slate-900 tabular-nums" dir="ltr">
          {estimatedValue > 0
            ? `${rfq.target_currency ?? "JOD"} ${Math.round(estimatedValue).toLocaleString()}`
            : "—"}
        </span>
        {quantity > 0 && (
          <div
            className={`text-[9px] px-1.5 py-0.5 rounded ${isUrgent ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}
          >
            {quantity.toLocaleString()} وحدة
          </div>
        )}
      </div>
    </div>
  );
}

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
  return (
    <div className={`flex flex-col shrink-0 ${status === "closed" ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2 mb-2">
        <StatusPill status={STATUS_PILL[status]} role="agent" />
        <span className="text-[10px] rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">{rfqs.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {rfqs.map((rfq) => (
          <KanbanCard key={rfq.id} rfq={rfq} products={productsMap[rfq.id] ?? []} onClick={() => onCardClick(rfq)} />
        ))}
        {rfqs.length === 0 && (
          <div className="w-[150px] rounded-lg border border-dashed border-slate-200 p-4 text-center text-[11px] text-slate-400">
            لا توجد طلبات
          </div>
        )}
      </div>
    </div>
  );
}

export function AgentDashboardMobile() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { columns, productsMap, stats, awaitingReply } = useAgentDashboardData();

  const { data: reelProducts } = useQuery({
    queryKey: ["dashboard-reel-preview", user?.id],
    queryFn: () => catalogService.search({ supplier_id: user?.id, page_size: 4 }),
    enabled: !!user?.id,
  });
  const clips = reelProducts?.items ?? [];

  return (
    <div className="flex flex-col gap-4" dir="rtl">
      {/* Welcome */}
      <div>
        <h1 className="text-[18px] font-bold text-slate-900">
          {user?.full_name ? `${user.full_name}، أهلاً` : "أهلاً"}
        </h1>
        {awaitingReply.length > 0 && (
          <p className="text-[12px] text-slate-500">لديك {awaitingReply.length} طلبات تنتظر ردّك</p>
        )}
      </div>

      {/* Awaiting-reply banner */}
      {awaitingReply.length > 0 && (
        <div className="rounded-lg bg-supplier-900 px-4 py-4 text-white">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-[13px] font-bold">طلبات تنتظر ردّك</h2>
              <p className="text-[11px] text-supplier-100">كل ساعة تأخير تقلل فرصة الفوز</p>
            </div>
            <Clock className="h-4 w-4 shrink-0 text-white/80" />
          </div>
          <button
            onClick={() => navigate(ROUTES.RFQ.SUPPLIER_INBOX)}
            className="w-full rounded-lg bg-white px-3 py-2.5 text-[12px] font-bold text-supplier-600 transition-all duration-150 hover:bg-supplier-50 active:scale-[0.98]"
          >
            عرض الطلبات الواردة
          </button>
        </div>
      )}

      {/* KPI stats — 3 on mobile per CLAUDE.md's dual-pattern rule */}
      <div className="grid grid-cols-3 gap-3">
        {stats.slice(0, 3).map((s) => (
          <StatCard key={s.label} value={s.value} label={s.label} />
        ))}
      </div>

      {/* Kanban board — horizontal scroll, 150px cards */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-[14px] font-bold text-slate-900">إدارة الطلبات</h2>
        <div className="flex gap-4 overflow-x-auto pb-1">
          {COL_ORDER.map((status) => (
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

      {/* Factory reels studio preview */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-slate-900">أستوديو لقطات المصنع</h2>
          <button
            onClick={() => navigate(ROUTES.AGENT.REELS)}
            className="rounded-lg bg-supplier-500 px-3 py-1.5 text-[12px] font-bold text-white transition-all duration-150 hover:bg-supplier-600 active:scale-[0.98]"
          >
            ارفع +
          </button>
        </div>

        {/* Same honest note as the desktop dashboard — no reels/video
            backend exists yet, so this reuses real catalog products. */}
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          <Video className="h-4 w-4 shrink-0" />
          رفع الفيديو غير متاح بعد — القياس عروض الأسعار الناتجة لا المشاهدات
        </div>

        <div className="grid grid-cols-2 gap-3">
          {clips.map((p) => (
            <ReelTile
              key={p.id}
              price={formatPrice(p.unit_price_rmb)}
              product={p.product_name ?? "منتج بدون اسم"}
              rfqCount={0}
              onClick={() => navigate(ROUTES.AGENT.REELS)}
            />
          ))}
          {clips.length === 0 && (
            <div className="col-span-2 rounded-lg border border-dashed border-slate-200 p-6 text-center text-[12px] text-slate-400">
              لا توجد منتجات بعد — ارفع كتالوجاً لتظهر بلاطاته هنا
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
