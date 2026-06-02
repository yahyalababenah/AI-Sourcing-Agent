import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";

export function RFQCreatePage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          طلب عرض سعر جديد
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          أدخل بيانات المنتج المطلوب للحصول على عرض سعر
        </p>
      </div>

      {/* Placeholder: RFQ create form will be implemented in Phase 2 */}
      <div className="card p-12 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto h-12 w-12 text-gray-300"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path d="M12 4v16m8-8H4" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-600">
          نموذج إنشاء طلب عرض سعر
        </h3>
        <p className="mt-2 text-sm text-gray-400">
          سيتم تنفيذ النموذج في المرحلة الثانية
        </p>
        <button
          onClick={() => navigate(ROUTES.RFQ.LIST)}
          className="mt-4 text-sm text-primary-600 hover:text-primary-700"
        >
          العودة إلى القائمة
        </button>
      </div>
    </div>
  );
}
