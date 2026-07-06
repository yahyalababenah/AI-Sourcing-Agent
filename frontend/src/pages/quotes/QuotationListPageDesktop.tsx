import { AlertCircle, FileText, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { useQuotationListData, quoteStatusPill, quoteTrackingStatus, TRACKING_LABELS } from "./useQuotationListData";

// Agent-facing "عروض الأسعار" table (T8.3): quotation number, client,
// amount, StatusPill status, shipment tracking (secondary), date, actions.
// No supplier-quotes-*.html reference exists (same gap as T6.3/T7.x/T8.x) —
// keeps this page's existing real quotationService.list() data, only the
// visual language + shared StatusPill/EmptyState/Skeleton changed. Other
// roles still see LegacyQuotationList (see QuotationListPage.tsx) — the
// client-facing T8.4 table turned out to target the separate /rfq route
// instead (see RFQListPage.tsx).
export function QuotationListPageDesktop() {
  const { quotations, isLoading, isError, error, refetch, handleView, handleTrack } = useQuotationListData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">عروض الأسعار</h1>
          <p className="mt-1 text-sm text-slate-500">إنشاء وإدارة عروض الأسعار للعملاء</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50 active:scale-[0.98]"
        >
          <RefreshCw className="h-4 w-4" />
          تحديث
        </button>
      </div>

      {isLoading ? (
        <div className="card space-y-3 p-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded" />
          ))}
        </div>
      ) : isError ? (
        <div className="card p-12 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-4 text-lg font-semibold text-slate-900">خطأ في تحميل البيانات</h3>
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
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-start text-sm font-medium text-slate-500">رقم العرض</th>
                  <th className="px-4 py-3 text-start text-sm font-medium text-slate-500">العميل</th>
                  <th className="px-4 py-3 text-start text-sm font-medium text-slate-500">المبلغ</th>
                  <th className="px-4 py-3 text-start text-sm font-medium text-slate-500">الحالة</th>
                  <th className="px-4 py-3 text-start text-sm font-medium text-slate-500">تتبع الشحنة</th>
                  <th className="px-4 py-3 text-start text-sm font-medium text-slate-500">التاريخ</th>
                  <th className="px-4 py-3 text-start text-sm font-medium text-slate-500">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotations.map((q) => {
                  const trackingStatus = quoteTrackingStatus(q);
                  return (
                    <tr
                      key={q.id}
                      onClick={() => handleView(q.id)}
                      className="cursor-pointer transition-colors duration-150 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{q.quotation_number}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {q.client_name || `${q.rfq_id.slice(0, 8)}...`}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900 tabular-nums" dir="ltr">
                        {q.grand_total.toLocaleString()} {q.target_currency}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={quoteStatusPill(q.status)} role="agent" />
                      </td>
                      <td className="px-4 py-3">
                        {trackingStatus ? (
                          <span className="inline-block rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                            {TRACKING_LABELS[trackingStatus] || trackingStatus}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {new Date(q.created_at).toLocaleDateString("ar-SA-u-ca-gregory")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleView(q.id);
                            }}
                            className="rounded-md bg-supplier-50 px-3 py-1 text-xs font-medium text-supplier-600 transition-colors duration-150 hover:bg-supplier-100 active:scale-[0.98]"
                          >
                            عرض
                          </button>
                          {q.status === "accepted" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTrack(q.id);
                              }}
                              className="rounded-md bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 transition-colors duration-150 hover:bg-amber-100 active:scale-[0.98]"
                            >
                              🚚 تتبع
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
