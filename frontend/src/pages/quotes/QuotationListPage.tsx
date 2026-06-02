export function QuotationListPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">عروض الأسعار</h1>
        <p className="mt-1 text-sm text-gray-500">
          إنشاء وإدارة عروض الأسعار للعملاء
        </p>
      </div>

      {/* Placeholder: Quotation list will be implemented in Phase 5 */}
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
          قائمة عروض الأسعار
        </h3>
        <p className="mt-2 text-sm text-gray-400">
          سيتم عرض عروض الأسعار هنا بعد الانتهاء من التكامل مع API
        </p>
      </div>
    </div>
  );
}
