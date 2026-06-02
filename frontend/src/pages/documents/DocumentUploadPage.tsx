export function DocumentUploadPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">رفع مستند</h1>
        <p className="mt-1 text-sm text-gray-500">
          رفع فاتورة، كتالوج، أو أي مستند لاستخراج بيانات المنتجات منه
        </p>
      </div>

      {/* Placeholder: Document upload will be implemented in Phase 3 */}
      <div className="card p-12 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto h-12 w-12 text-gray-300"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6h.1a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-600">
          رفع واستخراج البيانات
        </h3>
        <p className="mt-2 text-sm text-gray-400">
          سيتم تنفيذ واجهة رفع المستندات ومعالجتها في المرحلة الثالثة
        </p>
      </div>
    </div>
  );
}
