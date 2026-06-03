import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ROUTES } from "@/constants/routes";
import { intakeService } from "@/services/intakeService";
import type { RFQ } from "@/types/intake";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending: "bg-yellow-100 text-yellow-700",
  translated: "bg-blue-100 text-blue-700",
  quoted: "bg-green-100 text-green-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  pending: "قيد الانتظار",
  translated: "تمت الترجمة",
  quoted: "تم التسعير",
  accepted: "مقبول",
  rejected: "مرفوض",
  cancelled: "ملغي",
};

export function RFQListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading, error } = useQuery({
    queryKey: ["rfqs", statusFilter, page],
    queryFn: () => intakeService.list({ status: statusFilter, page, limit }),
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">طلبات العروض</h1>
          <p className="mt-1 text-sm text-gray-500">
            إدارة ومتابعة طلبات عروض الأسعار
          </p>
        </div>
        <button
          onClick={() => navigate(ROUTES.RFQ.CREATE)}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          + طلب عرض سعر جديد
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2">
        {["all", "draft", "pending", "translated", "quoted", "accepted", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatusFilter(s === "all" ? undefined : s);
              setPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              (s === "all" && !statusFilter) || statusFilter === s
                ? "bg-primary-100 text-primary-700 font-medium"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s === "all" ? "الكل" : STATUS_LABELS[s] || s}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="card p-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          <p className="mt-4 text-sm text-gray-500">جاري تحميل طلبات العروض...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="card p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-medium text-gray-600">خطأ في تحميل البيانات</h3>
          <p className="mt-2 text-sm text-red-500">{(error as Error).message}</p>
        </div>
      )}

      {/* Empty State */}
      {data && data.items.length === 0 && !isLoading && (
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
          <h3 className="mt-4 text-lg font-medium text-gray-600">لا توجد طلبات عروض</h3>
          <p className="mt-2 text-sm text-gray-400">
            لم يتم إنشاء أي طلب عرض سعر بعد. اضغط على "طلب عرض سعر جديد" للبدء.
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
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">العميل</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">الوجهة</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">العملة</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">الحالة</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">التاريخ</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((rfq: RFQ) => (
                  <tr
                    key={rfq.id}
                    className="transition-colors hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(ROUTES.RFQ.DETAIL(rfq.id))}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {rfq.client_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {rfq.destination_port || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {rfq.target_currency || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_COLORS[rfq.status] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {STATUS_LABELS[rfq.status] || rfq.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(rfq.created_at).toLocaleDateString("ar-SA")}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(ROUTES.RFQ.DETAIL(rfq.id));
                        }}
                        className="rounded-md bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-100"
                      >
                        عرض
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
              <p className="text-sm text-gray-500">
                الصفحة {page} من {totalPages} (إجمالي {data.total})
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  السابق
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
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
