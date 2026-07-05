import { AlertCircle, FileText, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { useQuotationListData, quoteStatusPill, quoteTrackingStatus, TRACKING_LABELS } from "./useQuotationListData";

// Same shared hook/data as QuotationListPageDesktop, stacked into a single
// column of cards instead of a table (a wide multi-column table doesn't fit
// mobile). TopBar/BottomNav/Drawer come from AgentLayout.
export function QuotationListPageMobile() {
  const { quotations, isLoading, isError, error, refetch, handleView, handleTrack } = useQuotationListData();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">عروض الأسعار</h1>
        <button
          onClick={() => refetch()}
          aria-label="تحديث"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition-colors duration-150 hover:bg-slate-50 active:scale-[0.98]"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card space-y-2 p-4">
              <Skeleton className="h-5 w-2/3 rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-8 w-full rounded" />
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
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-supplier-500 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-supplier-600 active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" />
            إعادة المحاولة
          </button>
        </div>
      ) : quotations.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="لا توجد عروض أسعار"
          description="لم يتم إنشاء أي عرض سعر بعد. قم بإنشاء طلب عرض سعر أولاً ثم توجه لحساب التسعير."
        />
      ) : (
        <div className="space-y-3">
          {quotations.map((q) => {
            const trackingStatus = quoteTrackingStatus(q);
            return (
              <div
                key={q.id}
                onClick={() => handleView(q.id)}
                className="card cursor-pointer p-4 transition-shadow duration-150 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{q.quotation_number}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{q.client_name || `${q.rfq_id.slice(0, 8)}...`}</p>
                  </div>
                  <StatusPill status={quoteStatusPill(q.status)} role="agent" />
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900 tabular-nums" dir="ltr">
                    {q.grand_total.toLocaleString()} {q.target_currency}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(q.created_at).toLocaleDateString("ar-SA-u-ca-gregory")}
                  </span>
                </div>

                {trackingStatus && (
                  <span className="mt-2 inline-block rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                    {TRACKING_LABELS[trackingStatus] || trackingStatus}
                  </span>
                )}

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleView(q.id);
                    }}
                    className="flex-1 rounded-md bg-supplier-50 px-3 py-1.5 text-xs font-medium text-supplier-600 transition-colors duration-150 hover:bg-supplier-100 active:scale-[0.98]"
                  >
                    عرض
                  </button>
                  {q.status === "accepted" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTrack(q.id);
                      }}
                      className="flex-1 rounded-md bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors duration-150 hover:bg-amber-100 active:scale-[0.98]"
                    >
                      🚚 تتبع
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
