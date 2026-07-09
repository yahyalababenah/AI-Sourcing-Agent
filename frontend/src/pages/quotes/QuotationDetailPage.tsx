import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ROUTES } from "@/constants/routes";
import { quotationService } from "@/services/quotationService";
import { intakeService } from "@/services/intakeService";
import { useAuthStore } from "@/stores/authStore";
import type { QuotationLineItem } from "@/types/quotes";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { GlossaryTerm } from "@/components/ui/GlossaryTerm";

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

const STATUS_GLOSSARY_MAP: Record<string, string> = {
  awaiting_payment: "AwaitingPayment",
  production: "Production",
  inland_freight: "InlandFreight",
  sea_freight: "SeaFreight",
  customs: "Customs",
  delivered: "Delivered",
};

const TRACKING_LABELS: Record<string, string> = {
  awaiting_payment: "بانتظار الدفع",
  production: "قيد التصنيع",
  inland_freight: "الشحن الداخلي",
  sea_freight: "الشحن البحري",
  customs: "التخليص الجمركي",
  delivered: "تم التسليم",
};

function TrackingStatusBadge({ status }: { status: string }) {
  const label = TRACKING_LABELS[status] || status;
  const term = STATUS_GLOSSARY_MAP[status];
  return term ? (
    <GlossaryTerm term={term}>
      <span className="inline-block rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
        🚚 {label}
      </span>
    </GlossaryTerm>
  ) : (
    <span className="inline-block rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
      🚚 {label}
    </span>
  );
}

export function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const role = useAuthStore((s) => s.role);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);

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
  const trackingStatus = (quote as any)?.tracking_status as string | undefined;

  // Client accept / reject mutations
  const acceptMutation = useMutation({
    mutationFn: () => quotationService.accept(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotation", id] }),
  });
  const rejectMutation = useMutation({
    mutationFn: () => quotationService.reject(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotation", id] });
      setShowRejectConfirm(false);
    },
  });

  // Agent/admin: send the quote to the client. Quotations created via the
  // quote builder land in "draft" and previously had no way to progress
  // further — nothing in the app ever called finalize or set status=sent
  // automatically, so a quote an agent had just "sent" from their
  // perspective silently sat in draft forever and the client never saw it
  // as sent. This mirrors the finalize → status=sent sequence already used
  // (and proven) by scripts/seed_demo_agent.py.
  const sendMutation = useMutation({
    mutationFn: async () => {
      if (quote!.status === "draft") {
        await quotationService.finalize(id!);
      }
      return quotationService.updateStatus(id!, "sent");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotation", id] }),
  });

  const canRespond =
    role === "client" &&
    quote &&
    (quote.status === "sent" || quote.status === "finalized");

  const canSend =
    role !== "client" &&
    quote &&
    (quote.status === "draft" || quote.status === "finalized");

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
        <div className="flex items-center gap-2">
          {trackingStatus && <TrackingStatusBadge status={trackingStatus} />}
          <span
            className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
              STATUS_COLORS[quote.status] || "bg-gray-100 text-gray-700"
            }`}
          >
            {STATUS_LABELS[quote.status] || quote.status}
          </span>
        </div>
      </div>

      {/* Summary Card */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">ملخص عرض السعر</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-primary-50 p-4 text-center">
            <p className="text-sm text-gray-500">
              <GlossaryTerm term="Subtotal">الإجمالي قبل الضريبة</GlossaryTerm>
            </p>
            <p className="mt-1 text-2xl font-bold text-primary-700">
              {quote.subtotal.toLocaleString()} {currency}
            </p>
          </div>
          {quote.vat_total != null && (
            <div className="rounded-lg bg-purple-50 p-4 text-center">
              <p className="text-sm text-gray-500">
                <GlossaryTerm term="VAT">ضريبة القيمة المضافة</GlossaryTerm>
              </p>
              <p className="mt-1 text-2xl font-bold text-purple-700">
                {quote.vat_total.toLocaleString()} {currency}
              </p>
            </div>
          )}
          <div className="rounded-lg bg-amber-50 p-4 text-center">
            <p className="text-sm text-gray-500">
              <GlossaryTerm term="GrandTotal">المبلغ النهائي</GlossaryTerm>
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-700">
              {quote.grand_total.toLocaleString()} {currency}
            </p>
          </div>
        </div>
        {quote.exchange_rate_used && (
          <p className="mt-3 text-xs text-gray-400" dir="ltr">
            <GlossaryTerm term="ExchangeRate">سعر الصرف</GlossaryTerm>: 1 CNY = {quote.exchange_rate_used} {currency}
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
                  <th className="px-4 py-2 text-sm font-medium text-gray-500">سعر الوحدة (<GlossaryTerm term="CNY">¥</GlossaryTerm>)</th>
                  <th className="px-4 py-2 text-sm font-medium text-gray-500">سعر الوحدة ({currency})</th>
                  <th className="px-4 py-2 text-sm font-medium text-gray-500">
                    <GlossaryTerm term="Freight">الشحن</GlossaryTerm>
                  </th>
                  <th className="px-4 py-2 text-sm font-medium text-gray-500">
                    <GlossaryTerm term="CustomsDuty">الجمارك</GlossaryTerm>
                  </th>
                  <th className="px-4 py-2 text-sm font-medium text-gray-500">
                    <GlossaryTerm term="Commission">العمولة</GlossaryTerm>
                  </th>
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

      {/* Client: Accept / Reject panel */}
      {canRespond && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h3 className="mb-1 text-sm font-semibold text-blue-900">هل تقبل عرض السعر هذا؟</h3>
          <p className="mb-4 text-xs text-blue-700">
            الموافقة تعني انطلاق عملية الشراء — سيصل إشعار للمندوب فوراً.
          </p>

          {showRejectConfirm ? (
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-red-700">تأكيد الرفض؟</p>
              <button
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending}
                className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                نعم، ارفض
              </button>
              <button
                onClick={() => setShowRejectConfirm(false)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                إلغاء
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                {acceptMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                قبول عرض السعر
              </button>
              <button
                onClick={() => setShowRejectConfirm(true)}
                className="flex items-center gap-2 rounded-lg border border-red-200 px-5 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
              >
                <XCircle className="h-4 w-4" />
                رفض
              </button>
            </div>
          )}
        </div>
      )}

      {/* Accepted confirmation */}
      {quote.status === "accepted" && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          ✅ وافقت على هذا العرض — الطلب قيد التنفيذ
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {canSend && (
          <button
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            إرسال العرض للعميل
          </button>
        )}
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
        {quote.status === "accepted" && (
          <button
            onClick={() => navigate(ROUTES.ORDERS.TRACKING(quote.id))}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700"
          >
            🚚 تتبع الشحنة
          </button>
        )}
      </div>
    </div>
  );
}
