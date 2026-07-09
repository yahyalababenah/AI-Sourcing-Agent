import { Sparkles, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { ROUTES } from "@/constants/routes";
import { StatCard } from "@/components/ui/StatCard";
import { StatusPill, type OrderStatus } from "@/components/ui/StatusPill";
import { ReelTile } from "@/components/ui/ReelTile";
import { GlossaryTerm } from "@/components/ui/GlossaryTerm";
import { useClientDashboardData, type ClientRfqStatus } from "./useClientDashboardData";
import type { RFQ } from "@/types/intake";

// Reference: handoff-designs/importer-home-desktop.html

function todayArabic() {
  return new Date().toLocaleDateString("ar-JO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const formatPrice = (price: number | null) => (price == null ? "—" : `¥${price.toLocaleString()}`);

// Same RFQ→StatusPill mapping used by the agent dashboard, so the four
// lifecycle labels/colors read identically for both roles (CLAUDE.md).
const STATUS_PILL: Record<ClientRfqStatus, OrderStatus> = {
  open: "pending",
  processing: "under_review",
  quoted: "negotiating",
  closed: "completed",
};

function firstProductLine(rfq: RFQ) {
  return rfq.client_request_arabic?.split("\n")[0]?.replace("المنتج: ", "") || "طلب توريد";
}

export function ClientDashboardDesktop() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { stats, recentRfqs, productsMap, quotesByRfq, catalogItems, catalogLoading } = useClientDashboardData();

  return (
    <div className="flex flex-col gap-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900">مرحباً، {user?.full_name || "مستورد"}</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">{todayArabic()}</p>
        </div>
        <button
          onClick={() => navigate(ROUTES.RFQ.CREATE)}
          className="flex items-center gap-2 rounded-lg bg-importer-500 px-4 py-2.5 text-[13px] font-bold text-white transition-all duration-150 hover:bg-importer-600 active:scale-[0.98]"
        >
          <Sparkles className="h-4 w-4" />
          <GlossaryTerm term="RFQ">طلب عرض سعر جديد</GlossaryTerm>
        </button>
      </div>

      {/* KPI stats */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map((s) => (
          <StatCard key={s.label} value={s.value} label={s.label} />
        ))}
      </div>

      {/* New today from factories */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-bold text-slate-900">جديد اليوم من المصانع</h2>
            <p className="text-[11px] text-slate-500">لقطات من موردين قد يهمّونك — شاهد واطلب عرض سعر مباشرة</p>
          </div>
          <button
            onClick={() => navigate(ROUTES.CATALOG.MARKETPLACE)}
            className="flex items-center gap-1 text-[12px] font-medium text-importer-600 transition-colors duration-150 hover:text-importer-700"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            عرض الكل
          </button>
        </div>

        {catalogLoading ? (
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : catalogItems.length > 0 ? (
          <div className="grid grid-cols-4 gap-3">
            {catalogItems.map((p) => (
              <div key={p.id}>
                <ReelTile
                  price={formatPrice(p.unit_price_rmb)}
                  product={p.product_name ?? "منتج بدون اسم"}
                  rfqCount={0}
                  playColor="text-importer-500"
                  onClick={() => navigate(ROUTES.CATALOG.MARKETPLACE)}
                />
                <p className="mt-1.5 text-center text-[11px] text-slate-500">
                  {p.factory_name ?? p.supplier_name ?? "مصنع غير مسمّى"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-[12px] text-slate-400">
            لا توجد منتجات في السوق العالمي بعد
          </div>
        )}
      </div>

      {/* Recent orders */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-slate-900">
            <GlossaryTerm term="RFQ">طلباتي الأخيرة</GlossaryTerm>
          </h2>
          <button
            onClick={() => navigate(ROUTES.RFQ.LIST)}
            className="text-[12px] font-medium text-importer-600 transition-colors duration-150 hover:text-importer-700"
          >
            عرض الكل
          </button>
        </div>

        {recentRfqs.length > 0 ? (
          <div className="flex flex-col">
            {recentRfqs.map((rfq) => {
              const quote = quotesByRfq.get(rfq.id);
              const quantity = (productsMap[rfq.id] ?? []).reduce((sum, p) => sum + (p.quantity ?? 0), 0);
              const status = STATUS_PILL[(rfq.status as ClientRfqStatus) ?? "open"] ?? "pending";

              return (
                <div
                  key={rfq.id}
                  onClick={() => navigate(ROUTES.RFQ.DETAIL(rfq.id))}
                  className="flex cursor-pointer items-center justify-between border-b border-slate-100 py-3 last:border-b-0 transition-colors duration-150 hover:bg-slate-50"
                >
                  <StatusPill status={status} role="client" />
                  <div className="text-end">
                    <div className="text-[12.5px] font-semibold text-slate-700">{firstProductLine(rfq)}</div>
                    <div className="text-[11px] text-slate-400">
                      {quantity > 0 ? `${quantity.toLocaleString()} وحدة` : ""}
                    </div>
                  </div>
                  <span className="text-[13px] font-bold font-mono text-slate-900 tabular-nums" dir="ltr">
                    {quote ? `${quote.target_currency} ${Math.round(quote.grand_total).toLocaleString()}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-[12px] text-slate-400">
            لا توجد طلبات بعد — ابدأ بطلب عرض سعر جديد
          </div>
        )}
      </div>
    </div>
  );
}
