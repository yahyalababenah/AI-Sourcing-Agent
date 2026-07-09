import { GlossaryTerm } from "@/components/ui/GlossaryTerm";
import { AlertCircle, ClipboardList, Plus, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { useClientRfqListData, rfqStatusPill, RFQ_FILTERS } from "./useClientRfqListData";

function firstLine(text: string): string {
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

// Client-facing "طلباتي" table (T8.4) — same /rfq route agents use for
// "طلبات الشراء" (unchanged legacy table for them, see RFQListPage.tsx),
// rebuilt here with the shared StatusPill and a "قيمة العرض" column
// showing each RFQ's latest quote value (or an honest "—" before one
// arrives), importer-colored per CLAUDE.md.
export function RFQListPageDesktop() {
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
    total,
    handleView,
    handleNewRfq,
  } = useClientRfqListData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">طلباتي</h1>
          <p className="mt-1 text-sm text-slate-500">إدارة ومتابعة طلبات عروض الأسعار الخاصة بك</p>
        </div>
        <button
          onClick={handleNewRfq}
          className="flex items-center gap-2 rounded-lg bg-importer-500 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-importer-600 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          <GlossaryTerm term="RFQ">طلب عرض سعر</GlossaryTerm> جديد
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {RFQ_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => handleFilterChange(f.value)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors duration-150 active:scale-[0.98] ${
              (f.value === "all" && !statusFilter) || statusFilter === f.value
                ? "bg-importer-100 font-medium text-importer-600"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.label}
          </button>
        ))}
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
          description='لم يتم إنشاء أي طلب عرض سعر بعد. اضغط على "طلب عرض سعر جديد" للبدء.'
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-start text-sm font-medium text-slate-500"><GlossaryTerm term="RFQ">الطلب</GlossaryTerm></th>
                  <th className="px-4 py-3 text-start text-sm font-medium text-slate-500">الوجهة</th>
                  <th className="px-4 py-3 text-start text-sm font-medium text-slate-500">قيمة العرض</th>
                  <th className="px-4 py-3 text-start text-sm font-medium text-slate-500">الحالة</th>
                  <th className="px-4 py-3 text-start text-sm font-medium text-slate-500">التاريخ</th>
                  <th className="px-4 py-3 text-start text-sm font-medium text-slate-500">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rfqs.map((rfq) => {
                  const quote = quotesByRfq.get(rfq.id);
                  return (
                    <tr
                      key={rfq.id}
                      onClick={() => handleView(rfq.id)}
                      className="cursor-pointer transition-colors duration-150 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {firstLine(rfq.client_request_arabic)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{rfq.destination_port || "—"}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900 tabular-nums" dir="ltr">
                        {quote ? `${Math.round(quote.grand_total).toLocaleString()} ${quote.target_currency}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={rfqStatusPill(rfq.status)} role="client" />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {new Date(rfq.created_at).toLocaleDateString("ar-SA-u-ca-gregory")}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleView(rfq.id);
                          }}
                          className="rounded-md bg-importer-50 px-3 py-1 text-xs font-medium text-importer-600 transition-colors duration-150 hover:bg-importer-100 active:scale-[0.98]"
                        >
                          عرض
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <p className="text-sm text-slate-500">
                الصفحة {page} من {totalPages} (إجمالي {total})
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition-colors duration-150 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
                >
                  السابق
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition-colors duration-150 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
                >
                  التالي
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
