import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Video } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { catalogService } from "@/services/catalogService";
import { ROUTES } from "@/constants/routes";
import { StatCard } from "@/components/ui/StatCard";
import { StatusPill, type OrderStatus } from "@/components/ui/StatusPill";
import { ReelTile } from "@/components/ui/ReelTile";
import { useAgentDashboardData, type AgentRfqStatus } from "./useAgentDashboardData";
import type { Product, RFQ } from "@/types/intake";

// Reference: handoff-designs/supplier-home-desktop.html

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

const formatPrice = (price: number | null) => (price == null ? "—" : `¥${price.toLocaleString()}`);

// The dashboard's own RFQ statuses map 1:1 onto StatusPill's OrderStatus —
// same four labels/colors CLAUDE.md defines ("قيد الانتظار → slate" etc.).
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
      className={`rounded-lg border p-3 cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md ${
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
          <span className="text-[17px] font-black font-mono text-amber-700 tabular-nums" dir="ltr">
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
    <div className={`flex-1 flex flex-col min-w-0 ${status === "closed" ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2 py-2.5 mb-2">
        <StatusPill status={STATUS_PILL[status]} role="agent" />
        <span className="text-[10px] rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">{rfqs.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {rfqs.map((rfq) => (
          <KanbanCard key={rfq.id} rfq={rfq} products={productsMap[rfq.id] ?? []} onClick={() => onCardClick(rfq)} />
        ))}
        {rfqs.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-[11px] text-slate-400">
            لا توجد طلبات
          </div>
        )}
      </div>
    </div>
  );
}

export function AgentDashboardDesktop() {
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
      {/* Header */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-[18px] font-bold text-slate-900">إدارة الطلبات</h1>
          <p className="text-[11px] text-slate-500">
            {todayArabic()} — مرحباً {user?.full_name}
          </p>
        </div>
        <button
          onClick={() => navigate(ROUTES.RFQ.CREATE)}
          className="rounded-lg bg-supplier-500 px-4 py-2 text-[12px] font-bold text-white transition-all duration-150 hover:bg-supplier-600 active:scale-[0.98]"
        >
          + طلب جديد
        </button>
      </div>

      {/* Awaiting-reply strip */}
      {awaitingReply.length > 0 && (
        <div className="rounded-lg bg-supplier-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-[14px] font-bold">طلبات عروض أسعار تنتظر ردّك</h2>
              <p className="text-[11px] text-supplier-100">
                {awaitingReply.length} طلب بانتظار الرد — كل دقيقة تأخير تقلل فرصة الفوز بالصفقة
              </p>
            </div>
            <button
              onClick={() => navigate(ROUTES.RFQ.SUPPLIER_INBOX)}
              className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-[12px] font-bold text-supplier-600 transition-all duration-150 hover:bg-supplier-50 active:scale-[0.98]"
            >
              عرض الكل
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {awaitingReply.slice(0, 4).map((rfq) => (
              <div
                key={rfq.id}
                className="rounded-md bg-white/10 px-2.5 py-1 text-[11px]"
              >
                {rfq.client_name || "العميل"} ·{" "}
                {rfq.client_request_arabic?.split("\n")[0]?.replace("المنتج: ", "") || "طلب توريد"}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI stats */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map((s) => (
          <StatCard key={s.label} value={s.value} label={s.label} />
        ))}
      </div>

      {/* Kanban board */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-[14px] font-bold text-slate-900">إدارة الطلبات</h2>
        <div className="flex gap-4 overflow-x-auto">
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
          <div>
            <h2 className="text-[14px] font-bold text-slate-900">أستوديو لقطات المصنع</h2>
            <p className="text-[11px] text-slate-500">
              المقياس هنا ليس المشاهدات — بل طلبات عروض الأسعار الناتجة عن كل لقطة
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(ROUTES.AGENT.REELS)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-50"
            >
              عرض الكل
            </button>
            <button
              onClick={() => navigate(ROUTES.AGENT.REELS)}
              className="rounded-lg bg-supplier-500 px-3 py-1.5 text-[12px] font-bold text-white transition-all duration-150 hover:bg-supplier-600 active:scale-[0.98]"
            >
              ارفع لقطة جديدة
            </button>
          </div>
        </div>

        {/* Honest note: no reels/video backend exists yet — this preview
            reuses real catalog products (same approach as ReelsStudioPage)
            rather than fabricating view/RFQ counts. */}
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
          <Video className="h-4 w-4 shrink-0" />
          رفع الفيديو غير متاح بعد — هذه البلاطات تعرض منتجاتك الحقيقية من الكتالوج بانتظار ميزة اللقطات المرئية
        </div>

        <div className="grid grid-cols-4 gap-3">
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
            <div className="col-span-4 rounded-lg border border-dashed border-slate-200 p-6 text-center text-[12px] text-slate-400">
              لا توجد منتجات بعد — ارفع كتالوجاً لتظهر بلاطاته هنا
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
