import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { intakeService } from "@/services/intakeService";
import { ROUTES } from "@/constants/routes";
import {
  ClipboardList,
  Upload,
  FileText,
  Eye,
  Loader2,
} from "lucide-react";

const RFQ_STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  processing: "bg-yellow-100 text-yellow-700",
  translated: "bg-purple-100 text-purple-700",
  quoted: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
};

/**
 * Agent Dashboard — RFQ Management & Document Processing Hub
 *
 * Agents can:
 * 1. View assigned RFQs that need processing
 * 2. Upload Chinese PDF catalogs/invoices to the AI processing endpoint
 * 3. Review AI-extracted data
 * 4. Generate final Arabic quotations
 */
export function AgentDashboard() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string | undefined>("open");

  // ── Assigned RFQs ──
  const { data: rfqsData, isLoading: rfqsLoading } = useQuery({
    queryKey: ["agent-rfqs", statusFilter],
    queryFn: () => intakeService.list({ status: statusFilter, limit: 20 }),
    staleTime: 15_000,
  });

  // ── Quick Stats ──
  const { data: openRfqs } = useQuery({
    queryKey: ["rfqs", "open", 1, 1],
    queryFn: () => intakeService.list({ status: "open", limit: 1 }),
    staleTime: 30_000,
  });
  const { data: processingDocs } = useQuery({
    queryKey: ["processing-docs-count"],
    queryFn: () => intakeService.list({ status: "processing", limit: 1 }),
    staleTime: 30_000,
  });

  const openCount = openRfqs?.total ?? 0;
  const processingCount = processingDocs?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Welcome & Stats */}
      <div className="card p-6">
        <h1 className="text-2xl font-bold text-gray-900">
          مرحباً {user?.full_name || ""} 👋
        </h1>
        <p className="mt-2 text-gray-600">
          لوحة تحكم الوكيل — إدارة طلبات العروض، رفع المستندات الصينية، واستخراج البيانات.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-600">طلبات مفتوحة</p>
            <p className="mt-1 text-2xl font-bold text-blue-700">{openCount}</p>
          </div>
          <div className="rounded-lg bg-yellow-50 p-4">
            <p className="text-sm font-medium text-yellow-600">قيد المعالجة</p>
            <p className="mt-1 text-2xl font-bold text-yellow-700">{processingCount}</p>
          </div>
          <div className="rounded-lg bg-green-50 p-4">
            <p className="text-sm font-medium text-green-600">إجمالي الطلبات</p>
            <p className="mt-1 text-2xl font-bold text-green-700">{rfqsData?.total ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          onClick={() => navigate(ROUTES.RFQ.LIST)}
          className="card flex items-center gap-3 p-4 text-right transition-colors hover:border-primary-300 hover:bg-primary-50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">طلبات العروض</h3>
            <p className="text-xs text-gray-500">عرض وإدارة جميع الطلبات</p>
          </div>
        </button>

        <button
          onClick={() => navigate(ROUTES.DOCUMENTS.UPLOAD)}
          className="card flex items-center gap-3 p-4 text-right transition-colors hover:border-primary-300 hover:bg-primary-50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">رفع مستند</h3>
            <p className="text-xs text-gray-500">رفع كتالوج أو فاتورة صينية</p>
          </div>
        </button>

        <button
          onClick={() => navigate(ROUTES.PRICING.CALCULATE)}
          className="card flex items-center gap-3 p-4 text-right transition-colors hover:border-primary-300 hover:bg-primary-50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">حساب التسعير</h3>
            <p className="text-xs text-gray-500">احتساب التكلفة النهائية</p>
          </div>
        </button>

        <button
          onClick={() => navigate(ROUTES.QUOTES.LIST)}
          className="card flex items-center gap-3 p-4 text-right transition-colors hover:border-primary-300 hover:bg-primary-50"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">عروض الأسعار</h3>
            <p className="text-xs text-gray-500">عروض الأسعار المنشأة</p>
          </div>
        </button>
      </div>

      {/* ── Assigned RFQs Table ── */}
      <div className="card">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">طلبات العروض الموكلة إليك</h2>
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap gap-2 border-b border-gray-100 px-5 py-3">
          {[
            { key: undefined, label: "الكل" },
            { key: "open", label: "مفتوحة" },
            { key: "processing", label: "قيد المعالجة" },
            { key: "translated", label: "تمت الترجمة" },
            { key: "quoted", label: "تم التسعير" },
          ].map((f) => (
            <button
              key={f.key || "all"}
              onClick={() => setStatusFilter(f.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === f.key
                  ? "bg-primary-100 text-primary-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {rfqsLoading && (
          <div className="p-8 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
            <p className="mt-3 text-sm text-gray-500">جاري تحميل الطلبات...</p>
          </div>
        )}

        {/* Empty */}
        {rfqsData && rfqsData.items.length === 0 && !rfqsLoading && (
          <div className="p-8 text-center">
            <ClipboardList className="mx-auto h-10 w-10 text-gray-300" />
            <h3 className="mt-3 text-sm font-medium text-gray-600">لا توجد طلبات</h3>
            <p className="mt-1 text-xs text-gray-400">
              {statusFilter
                ? `لا توجد طلبات بحالة "${statusFilter}"`
                : "لم يتم توكيل أي طلبات لك بعد"}
            </p>
          </div>
        )}

        {/* Table */}
        {rfqsData && rfqsData.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">العميل</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">الطلب</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">الوجهة</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">الحالة</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">التاريخ</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rfqsData.items.map((rfq) => (
                  <tr key={rfq.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {rfq.client_name || "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-sm text-gray-600">
                      {rfq.client_request_arabic?.slice(0, 60) || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {rfq.destination_port || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          RFQ_STATUS_COLORS[rfq.status] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {rfq.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(rfq.created_at).toLocaleDateString("ar-SA")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(ROUTES.RFQ.DETAIL(rfq.id))}
                          className="flex items-center gap-1 rounded-md bg-primary-50 px-2.5 py-1.5 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-100"
                        >
                          <Eye className="h-3 w-3" />
                          عرض
                        </button>
                        {rfq.status === "open" && (
                          <button
                            onClick={() => navigate(ROUTES.DOCUMENTS.UPLOAD)}
                            className="flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                          >
                            <Upload className="h-3 w-3" />
                            رفع
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
