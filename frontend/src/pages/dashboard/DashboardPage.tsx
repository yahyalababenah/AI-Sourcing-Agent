import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { intakeService } from "@/services/intakeService";
import { quotationService } from "@/services/quotationService";
import { ROUTES } from "@/constants/routes";

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  // ── Dashboard stats ──────────────────────────────────────
  const { data: rfqsData } = useQuery({
    queryKey: ["rfqs", "all", 1, 1],
    queryFn: () => intakeService.list({ limit: 1 }),
    staleTime: 30_000,
  });

  const { data: pendingRfqs } = useQuery({
    queryKey: ["rfqs", "pending", 1, 1],
    queryFn: () => intakeService.list({ status: "open", limit: 1 }),
    staleTime: 30_000,
  });

  const { data: quotesData } = useQuery({
    queryKey: ["quotations", "all"],
    queryFn: () => quotationService.list(),
    staleTime: 30_000,
  });

  const rfqCount = rfqsData?.total ?? 0;
  const pendingCount = pendingRfqs?.total ?? 0;
  const quoteCount = quotesData?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="card p-6">
        <h1 className="text-2xl font-bold text-gray-900">
          مرحباً {user?.full_name || ""} 👋
        </h1>
        <p className="mt-2 text-gray-600">
          مرحباً بك في منصة AI-Sourcing Hub. يمكنك من هنا إدارة طلبات العروض،
          رفع المستندات، وحساب التسعير.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5">
          <h3 className="text-sm font-medium text-gray-500">طلبات العروض</h3>
          <p className="mt-2 text-3xl font-bold text-primary-700">{rfqCount}</p>
          <p className="mt-1 text-xs text-gray-400">إجمالي طلبات العروض</p>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-medium text-gray-500">المستندات</h3>
          <p className="mt-2 text-3xl font-bold text-primary-700">—</p>
          <p className="mt-1 text-xs text-gray-400">المستندات المرفوعة</p>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-medium text-gray-500">عروض الأسعار</h3>
          <p className="mt-2 text-3xl font-bold text-primary-700">{quoteCount}</p>
          <p className="mt-1 text-xs text-gray-400">عروض الأسعار المنشأة</p>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-medium text-gray-500">قيد المعالجة</h3>
          <p className="mt-2 text-3xl font-bold text-yellow-600">{pendingCount}</p>
          <p className="mt-1 text-xs text-gray-400">طلبات قيد المعالجة</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          إجراءات سريعة
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <button
            onClick={() => navigate(ROUTES.RFQ.CREATE)}
            className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-right transition-colors hover:border-primary-300 hover:bg-primary-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">طلب عرض سعر جديد</h3>
              <p className="text-sm text-gray-500">
                إنشاء طلب عرض سعر جديد
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate(ROUTES.DOCUMENTS.UPLOAD)}
            className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-right transition-colors hover:border-primary-300 hover:bg-primary-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">رفع مستند</h3>
              <p className="text-sm text-gray-500">
                رفع فاتورة أو كتالوج للتحليل
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate(ROUTES.PRICING.CALCULATE)}
            className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-right transition-colors hover:border-primary-300 hover:bg-primary-50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">حساب التسعير</h3>
              <p className="text-sm text-gray-500">
                حساب التكلفة النهائية للاستيراد
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
