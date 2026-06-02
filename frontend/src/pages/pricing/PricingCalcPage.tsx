export function PricingCalcPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          حاسبة التسعير
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          حساب التكلفة النهائية لاستيراد المنتجات
        </p>
      </div>

      {/* Placeholder: Pricing calculator will be implemented in Phase 4 */}
      <div className="card p-12 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto h-12 w-12 text-gray-300"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-600">
          حاسبة التسعير
        </h3>
        <p className="mt-2 text-sm text-gray-400">
          سيتم تنفيذ حاسبة التسعير المتكاملة في المرحلة الرابعة
        </p>
      </div>
    </div>
  );
}
