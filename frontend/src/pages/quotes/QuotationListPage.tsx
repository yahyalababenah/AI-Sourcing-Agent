import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ROUTES } from "@/constants/routes";
import { quotationService } from "@/services/quotationService";
import { useAuthStore } from "@/stores/authStore";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { QuotationListPageDesktop } from "./QuotationListPageDesktop";
import { QuotationListPageMobile } from "./QuotationListPageMobile";
import type { Quotation } from "@/types/quotes";

// Role gateway (T8.3): agents get the rebuilt StatusPill-based table
// (QuotationListPageDesktop/Mobile). Clients/admins keep this legacy table
// unchanged for now — same pattern as ProfilePage.tsx/RFQCreatePage.tsx —
// until T8.4 builds the importer-facing view on this same /quotes route.
export function QuotationListPage() {
  const role = useAuthStore((s) => s.role);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  if (role === "agent") {
    return isDesktop ? <QuotationListPageDesktop /> : <QuotationListPageMobile />;
  }

  return <LegacyQuotationList />;
}

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

const TRACKING_LABELS: Record<string, string> = {
  awaiting_payment: "بانتظار الدفع",
  production: "قيد التصنيع",
  inland_freight: "الشحن الداخلي",
  sea_freight: "الشحن البحري",
  customs: "التخليص الجمركي",
  delivered: "تم التسليم",
};

function LegacyQuotationList() {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["quotations"],
    queryFn: () => quotationService.list(),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">عروض الأسعار</h1>
          <p className="mt-1 text-sm text-gray-500">إنشاء وإدارة عروض الأسعار للعملاء</p>
        </div>
        <div className="card p-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          <p className="mt-4 text-sm text-gray-500">جاري تحميل عروض الأسعار...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">عروض الأسعار</h1>
          <p className="mt-1 text-sm text-gray-500">إنشاء وإدارة عروض الأسعار للعملاء</p>
        </div>
        <div className="card p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-medium text-gray-600">خطأ في تحميل البيانات</h3>
          <p className="mt-2 text-sm text-red-500">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">عروض الأسعار</h1>
        <p className="mt-1 text-sm text-gray-500">
          إنشاء وإدارة عروض الأسعار للعملاء
        </p>
      </div>

      {/* Empty State */}
      {data && data.items.length === 0 && (
        <div className="card p-12 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto h-12 w-12 text-gray-300"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path d="M9 12h6M9 16h6M9 8h6M4 6h.01M4 10h.01M4 14h.01M4 18h.01" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-600">لا توجد عروض أسعار</h3>
          <p className="mt-2 text-sm text-gray-400">
            لم يتم إنشاء أي عرض سعر بعد. قم بإنشاء طلب عرض سعر أولاً ثم توجه لحساب التسعير.
          </p>
        </div>
      )}

      {/* Table */}
      {data && data.items.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">رقم العرض</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">العميل</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">المبلغ</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">الحالة</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">تتبع الشحنة</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">التاريخ</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((q: Quotation) => (
                  <tr
                    key={q.id}
                    className="transition-colors hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(ROUTES.QUOTES.DETAIL(q.id))}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {q.quotation_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {q.client_name || q.rfq_id.slice(0, 8) + "..."}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {q.grand_total.toLocaleString()} {q.target_currency}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_COLORS[q.status] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {STATUS_LABELS[q.status] || q.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(q as any).tracking_status ? (
                        <span className="inline-block rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                          {(TRACKING_LABELS as any)[(q as any).tracking_status] || (q as any).tracking_status}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(q.created_at).toLocaleDateString("ar-SA-u-ca-gregory")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(ROUTES.QUOTES.DETAIL(q.id));
                          }}
                          className="rounded-md bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-100"
                        >
                          عرض
                        </button>
                        {q.status === "accepted" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(ROUTES.ORDERS.TRACKING(q.id));
                            }}
                            className="rounded-md bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
                          >
                            🚚 تتبع
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
