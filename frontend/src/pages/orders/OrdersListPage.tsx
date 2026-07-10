import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Truck, Package, Search } from "lucide-react";
import { useState } from "react";
import { ROUTES } from "@/constants/routes";
import { quotationService } from "@/services/quotationService";
import type { Quotation } from "@/types/quotes";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

const TRACKING_LABELS: Record<string, string> = {
  awaiting_payment: "بانتظار الدفع",
  production: "قيد التصنيع",
  inland_freight: "الشحن الداخلي",
  sea_freight: "الشحن البحري",
  customs: "التخليص الجمركي",
  delivered: "تم التسليم",
};

const TRACKING_COLORS: Record<string, string> = {
  awaiting_payment: "bg-amber-100 text-amber-700",
  production: "bg-sky-100 text-sky-700",
  inland_freight: "bg-slate-200 text-slate-700",
  sea_freight: "bg-cyan-100 text-cyan-700",
  customs: "bg-orange-100 text-orange-700",
  delivered: "bg-emerald-100 text-emerald-700",
};

const PIPELINE = [
  "awaiting_payment",
  "production",
  "inland_freight",
  "sea_freight",
  "customs",
  "delivered",
];

export function OrdersListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["quotations"],
    queryFn: () => quotationService.list(),
  });

  const orders = (data?.items ?? []).filter(
    (q: Quotation) => q.status === "accepted"
  );

  const filtered = search.trim()
    ? orders.filter(
        (q: Quotation) =>
          q.quotation_number.toLowerCase().includes(search.toLowerCase()) ||
          (q.client_name ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : orders;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <div className="card p-12 text-center">
          <p className="text-sm text-red-500">{(error as Error).message}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 rounded-lg border border-red-300 px-4 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader />

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="بحث برقم الشحنة أو اسم العميل..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pr-10 pl-4 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
        />
      </div>

      {/* Empty: no accepted orders at all */}
      {orders.length === 0 && (
        <EmptyState
          icon={Truck}
          title="لا توجد شحنات نشطة"
          description="ستظهر الشحنات هنا بعد قبول عروض الأسعار."
          actionLabel="عرض كل العروض"
          onAction={() => navigate(ROUTES.QUOTES.LIST)}
        />
      )}

      {/* Empty search result */}
      {orders.length > 0 && filtered.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sm text-gray-400">لا توجد نتائج لـ "{search}"</p>
        </div>
      )}

      {/* Orders list */}
      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((q: Quotation) => {
            const trackingStatus = (q as any).tracking_status as string | null;
            const pipelineIdx = trackingStatus ? PIPELINE.indexOf(trackingStatus) : -1;

            return (
              <div key={q.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {/* Info */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{q.quotation_number}</p>
                      <p className="text-xs text-gray-500">
                        {q.client_name ?? q.rfq_id.slice(0, 8) + "..."} ·{" "}
                        {q.grand_total.toLocaleString()} {q.target_currency}
                      </p>
                    </div>
                  </div>

                  {/* Tracking badge + action */}
                  <div className="flex items-center gap-2">
                    {trackingStatus ? (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          TRACKING_COLORS[trackingStatus] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {TRACKING_LABELS[trackingStatus] ?? trackingStatus}
                      </span>
                    ) : (
                      <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
                        بانتظار البدء
                      </span>
                    )}
                    <button
                      onClick={() => navigate(ROUTES.ORDERS.TRACKING(q.id))}
                      className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
                    >
                      <Truck className="h-3.5 w-3.5" />
                      تتبع
                    </button>
                  </div>
                </div>

                {/* Pipeline progress bar */}
                <div className="mt-4">
                  <div className="flex justify-between">
                    {PIPELINE.map((step, i) => (
                      <div key={step} className="flex flex-1 flex-col items-center">
                        <div
                          className={`h-2 w-full ${
                            i === 0 ? "rounded-r-full" : i === PIPELINE.length - 1 ? "rounded-l-full" : ""
                          } ${i <= pipelineIdx ? "bg-primary-500" : "bg-gray-100"}`}
                        />
                        <span
                          className={`mt-1 hidden text-center text-xs lg:block ${
                            i === pipelineIdx
                              ? "font-semibold text-primary-600"
                              : "text-gray-400"
                          }`}
                        >
                          {TRACKING_LABELS[step]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="mt-2 text-end text-xs text-gray-400">
                  {new Date(q.created_at).toLocaleDateString("ar-SA-u-ca-gregory")}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PageHeader() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
        <Truck className="h-5 w-5" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">تتبع الشحنات</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          الطلبات المقبولة وحالة شحنها من الصين إلى العقبة
        </p>
      </div>
    </div>
  );
}
