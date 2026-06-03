import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ROUTES } from "@/constants/routes";
import { quotationService } from "@/services/quotationService";
import { intakeService } from "@/services/intakeService";
import type { QuotationLineItem } from "@/types/quotes";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending: "bg-yellow-100 text-yellow-700",
  finalized: "bg-green-100 text-green-700",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  pending: "قيد الانتظار",
  finalized: "نهائي",
  sent: "تم الإرسال",
  accepted: "مقبول",
  rejected: "مرفوض",
};

export function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: quote, isLoading, error } = useQuery({
    queryKey: ["quotation", id],
    queryFn: () => quotationService.get(id!),
    enabled: !!id,
  });

  // Fetch RFQ for client name (backend may not include it)
  const { data: rfq } = useQuery({
    queryKey: ["rfq", quote?.rfq_id],
    queryFn: () => intakeService.get(quote!.rfq_id),
    enabled: !!quote?.rfq_id,
  });

  const clientName = quote?.client_name || rfq?.client_name || "—";
  const currency = quote?.target_currency || "JOD";
  const lineItems: QuotationLineItem[] = (quote?.line_items as QuotationLineItem[]) || [];

  if (isLoading) {
    return (
      <div className="card p-12 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        <p className="mt-4 text-sm text-gray-500">جاري تحميل تفاصيل عرض السعر...</p>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="card p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="mt-4 text-lg font-medium text-gray-600">خطأ في تحميل التفاصيل</h3>
        <p className="mt-2 text-sm text-red-500">{(error as Error)?.message || "لم يتم العثور على عرض السعر"}</p>
        <button
          onClick={() => navigate(ROUTES.QUOTES.LIST)}
          className="mt-4 text-sm text-primary-600 hover:text-primary-700"
        >
          العودة إلى القائمة
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(ROUTES.QUOTES.LIST)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
          >
            → العودة
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              تفاصيل عرض السعر
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {quote.quotation_number} — {clientName}
            </p>
          </div>
        </div>
        <span
          className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
            STATUS_COLORS[quote.status] || "bg-gray-100 text-gray-700"
          }`}
        >
          {STATUS_LABELS[quote.status] || quote.status}
        </span>
      </div>

      {/* Summary Card */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">ملخص عرض السعر</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-primary-50 p-4 text-center">
            <p className="text-sm text-gray-500">الإجمالي قبل الضريبة</p>
            <p className="mt-1 text-2xl font-bold text-primary-700">
              {quote.subtotal.toLocaleString()} {currency}
            </p>
          </div>
          {quote.vat_total != null && (
            <div className="rounded-lg bg-purple-50 p-4 text-center">
              <p className="text-sm text-gray-500">ضريبة القيمة المضافة</p>
              <p className="mt-1 text-2xl font-bold text-purple-700">
                {quote.vat_total.toLocaleString()} {currency}
              </p>
            </div>
          )}
          <div className="rounded-lg bg-amber-50 p-4 text-center">
            <p className="text-sm text-gray-500">المبلغ النهائي</p>
            <p className="mt-1 text-2xl font-bold text-amber-700">
              {quote.grand_total.toLocaleString()} {currency}
            </p>
          </div>
        </div>
        {quote.exchange_rate_used && (
          <p className="mt-3 text-xs text-gray-400" dir="ltr">
            سعر الصرف: 1 CNY = {quote.exchange_rate_used} {currency}
          </p>
        )}
        {quote.notes && (
          <div className="mt-4 rounded-lg bg-gray-50 p-3">
            <p className="text-sm text-gray-500">ملاحظات</p>
            <p className="mt-1 text-sm text-gray-700">{quote.notes}</p>
          </div>
        )}
      </div>

      {/* Line Items */}
      {lineItems.length > 0 && (
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">بنود عرض السعر</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-sm font-medium text-gray-500">المنتج</th>
                  <th className="px-4 py-2 text-sm font-medium text-gray-500">الكمية</th>
                  <th className="px-4 py-2 text-sm font-medium text-gray-500">سعر الوحدة (¥)</th>
                  <th className="px-4 py-2 text-sm font-medium text-gray-500">سعر الوحدة ({currency})</th>
                  <th className="px-4 py-2 text-sm font-medium text-gray-500">الشحن</th>
                  <th className="px-4 py-2 text-sm font-medium text-gray-500">الجمارك</th>
                  <th className="px-4 py-2 text-sm font-medium text-gray-500">العمولة</th>
                  <th className="px-4 py-2 text-sm font-medium text-gray-500">المجموع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lineItems.map((item: QuotationLineItem, i: number) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">
                      {item.product_name}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">{item.quantity}</td>
                    <td className="px-4 py-2 text-sm text-gray-600" dir="ltr">
                      {item.unit_price_cny.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600" dir="ltr">
                      {(item.unit_price_converted || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600" dir="ltr">
                      {(item.freight_cost || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600" dir="ltr">
                      {(item.customs_duty || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600" dir="ltr">
                      {(item.commission || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900" dir="ltr">
                      {(item.total || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={async () => {
            try {
              await quotationService.generatePdf(quote.id);
              window.open(quotationService.getPdfUrl(quote.id), "_blank");
            } catch {
              // Fallback: just redirect
              window.open(quotationService.getPdfUrl(quote.id), "_blank");
            }
          }}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          تحميل PDF
        </button>
        <button
          onClick={() => navigate(ROUTES.RFQ.DETAIL(quote.rfq_id))}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          عرض طلب عرض السعر
        </button>
      </div>
    </div>
  );
}
