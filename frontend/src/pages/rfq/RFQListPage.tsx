import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";

export function RFQListPage() {
  const navigate = useNavigate();

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

      {/* Placeholder: RFQ table/list will be implemented in Phase 2 */}
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
        <h3 className="mt-4 text-lg font-medium text-gray-600">
          قائمة طلبات العروض
        </h3>
        <p className="mt-2 text-sm text-gray-400">
          سيتم عرض طلبات العروض هنا بعد الانتهاء من التكامل مع API
        </p>
      </div>
    </div>
  );
}
