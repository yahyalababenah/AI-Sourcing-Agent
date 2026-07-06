import { AlertCircle, ClipboardList, Plus, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { useClientRfqListData, rfqStatusPill, RFQ_FILTERS } from "./useClientRfqListData";

function firstLine(text: string): string {
  return text.length > 44 ? `${text.slice(0, 44)}…` : text;
}

// Same shared hook/data as RFQListPageDesktop, stacked into a single
// column of cards with a horizontally scrollable filter chip row. TopBar/
// BottomNav/Drawer come from ClientLayout.
export function RFQListPageMobile() {
  const {
    rfqs,
    quotesByRfq,
    isLoading,
    isError,
    error,
    refetch,
    statusFilter,
    handleFilterChange,
    page,
    setPage,
    totalPages,
    handleView,
    handleNewRfq,
  } = useClientRfqListData();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">طلباتي</h1>
        <button
          onClick={handleNewRfq}
          aria-label="طلب عرض سعر جديد"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-importer-500 text-white transition-colors duration-150 hover:bg-importer-600 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {RFQ_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => handleFilterChange(f.value)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors duration-150 active:scale-[0.98] ${
              (f.value === "all" && !statusFilter) || statusFilter === f.value
                ? "bg-importer-100 font-medium text-importer-600"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card space-y-2 p-4">
              <Skeleton className="h-5 w-2/3 rounded" />
              <Skeleton className="h-4 w-full rounded" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="card p-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
          <h3 className="mt-3 text-base font-semibold text-slate-900">خطأ في تحميل البيانات</h3>
          <p className="mt-2 text-sm text-red-500">{error instanceof Error ? error.message : "يرجى المحاولة مرة أخرى"}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-importer-500 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-importer-600 active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" />
            إعادة المحاولة
          </button>
        </div>
      ) : rfqs.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="لا توجد طلبات عروض"
          description='لم يتم إنشاء أي طلب عرض سعر بعد. اضغط على "+" للبدء.'
        />
      ) : (
        <>
          <div className="space-y-3">
            {rfqs.map((rfq) => {
              const quote = quotesByRfq.get(rfq.id);
              return (
                <div
                  key={rfq.id}
                  onClick={() => handleView(rfq.id)}
                  className="card cursor-pointer p-4 transition-shadow duration-150 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <p className="max-w-[70%] text-sm font-medium text-slate-900">
                      {firstLine(rfq.client_request_arabic)}
                    </p>
                    <StatusPill status={rfqStatusPill(rfq.status)} role="client" />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-500">{rfq.destination_port || "—"}</span>
                    <span className="text-xs text-slate-400">
                      {new Date(rfq.created_at).toLocaleDateString("ar-SA-u-ca-gregory")}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900 tabular-nums" dir="ltr">
                    {quote ? `${Math.round(quote.grand_total).toLocaleString()} ${quote.target_currency}` : "—"}
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition-colors duration-150 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
              >
                السابق
              </button>
              <span className="text-sm text-slate-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition-colors duration-150 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
              >
                التالي
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
