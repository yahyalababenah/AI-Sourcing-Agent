import { useAuthStore } from "@/stores/authStore";

export function PricingRulesPage() {
  const role = useAuthStore((s) => s.role);
  const isAdmin = role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">قواعد التسعير</h1>
          <p className="mt-1 text-sm text-gray-500">
            إدارة قواعد واحتساب التكاليف
          </p>
        </div>
        {isAdmin && (
          <button
            disabled
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white opacity-50"
          >
            + إضافة قاعدة
          </button>
        )}
      </div>

      {/* Placeholder: Pricing rules will be implemented in Phase 4 */}
      <div className="card p-12 text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto h-12 w-12 text-gray-300"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-600">
          قواعد التسعير
        </h3>
        <p className="mt-2 text-sm text-gray-400">
          سيتم عرض وإدارة قواعد التسعير في المرحلة الرابعة
        </p>
      </div>
    </div>
  );
}
