import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ROUTES } from "@/constants/routes";
import { intakeService } from "@/services/intakeService";
import { quotationService } from "@/services/quotationService";

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  pending: "قيد الانتظار",
  translated: "تمت الترجمة",
  quoted: "تم التسعير",
  accepted: "مقبول",
  rejected: "مرفوض",
  cancelled: "ملغي",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending: "bg-yellow-100 text-yellow-700",
  translated: "bg-blue-100 text-blue-700",
  quoted: "bg-green-100 text-green-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export function RFQDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: rfq, isLoading, error } = useQuery({
    queryKey: ["rfq", id],
    queryFn: () => intakeService.get(id!),
    enabled: !!id,
  });

  const { data: products } = useQuery({
    queryKey: ["rfq-products", id],
    queryFn: () => intakeService.listProducts(id!),
    enabled: !!id,
  });

  const { data: quotations } = useQuery({
    queryKey: ["quotes", id],
    queryFn: () => quotationService.list({ rfq_id: id }),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="card p-12 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        <p className="mt-4 text-sm text-gray-500">جاري تحميل التفاصيل...</p>
      </div>
    );
  }

  if (error || !rfq) {
    return (
      <div className="card p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="mt-4 text-lg font-medium text-gray-600">خطأ في تحميل التفاصيل</h3>
        <p className="mt-2 text-sm text-red-500">{(error as Error)?.message || "لم يتم العثور على طلب عرض السعر"}</p>
        <button
          onClick={() => navigate(ROUTES.RFQ.LIST)}
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
            onClick={() => navigate(ROUTES.RFQ.LIST)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
          >
            → العودة
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              تفاصيل طلب عرض السعر
            </h1>
            <p className="mt-1 text-sm text-gray-500">RFQ #{rfq.id.slice(0, 8)}</p>
          </div>
        </div>
        <span
          className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
            STATUS_COLORS[rfq.status] || "bg-gray-100 text-gray-700"
          }`}
        >
          {STATUS_LABELS[rfq.status] || rfq.status}
        </span>
      </div>

      {/* Main Info Card */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">معلومات العميل</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">اسم العميل</p>
            <p className="font-medium text-gray-900">{rfq.client_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">الهاتف</p>
            <p className="font-medium text-gray-900" dir="ltr">
              {rfq.client_phone || "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">ميناء الوصول</p>
            <p className="font-medium text-gray-900">{rfq.destination_port || "—"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">العملة المستهدفة</p>
            <p className="font-medium text-gray-900">{rfq.target_currency || "—"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">تاريخ الإنشاء</p>
            <p className="font-medium text-gray-900">
              {new Date(rfq.created_at).toLocaleDateString("ar-SA")}
            </p>
          </div>
        </div>
      </div>

      {/* Client Request Card */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">طلب العميل</h2>
        <p className="text-sm leading-relaxed text-gray-700">
          {rfq.client_request_arabic}
        </p>
        {rfq.translated_query_chinese && (
          <>
            <h3 className="mt-4 mb-2 text-sm font-medium text-gray-500">الترجمة للصينية</h3>
            <p className="text-sm leading-relaxed text-gray-600" dir="ltr">
              {rfq.translated_query_chinese}
            </p>
          </>
        )}
      </div>

      {/* Products Card */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">المنتجات</h2>
        {products && products.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-sm font-medium text-gray-500">المنتج</th>
                  <th className="px-4 py-2 text-sm font-medium text-gray-500">الكمية</th>
                  <th className="px-4 py-2 text-sm font-medium text-gray-500">المواصفات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-sm text-gray-900">{p.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {p.quantity}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">{p.specifications || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400">لم يتم إضافة منتجات بعد</p>
        )}
      </div>

      {/* Quotations Card */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">عروض الأسعار</h2>
        {quotations && quotations.items.length > 0 ? (
          <div className="space-y-3">
            {quotations.items.map((q) => (
              <div
                key={q.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(ROUTES.QUOTES.DETAIL(q.id))}
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{q.quotation_number}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(q.created_at).toLocaleDateString("ar-SA")}
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-primary-700">
                    {q.grand_total.toLocaleString()} {q.target_currency}
                  </p>
                  <span className="text-xs text-gray-500">{q.status}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">لم يتم إنشاء عروض أسعار بعد</p>
        )}
        <button
          onClick={() => navigate(ROUTES.PRICING.CALCULATE)}
          className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          إنشاء عرض سعر
        </button>
      </div>
    </div>
  );
}
