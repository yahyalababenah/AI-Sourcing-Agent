import { useParams, useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";

export function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
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
          <p className="mt-1 text-sm text-gray-500">Quote #{id}</p>
        </div>
      </div>

      {/* Placeholder: Quotation detail will be implemented in Phase 5 */}
      <div className="card p-12 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto h-12 w-12 text-gray-300"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-600">
          تفاصيل عرض السعر
        </h3>
        <p className="mt-2 text-sm text-gray-400">
          سيتم عرض تفاصيل عرض السعر رقم {id} هنا في المرحلة الخامسة
        </p>
      </div>
    </div>
  );
}
