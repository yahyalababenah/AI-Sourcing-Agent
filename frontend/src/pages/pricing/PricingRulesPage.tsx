import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useAuthStore } from "@/stores/authStore";
import { pricingService } from "@/services/pricingService";
import { FORMULA_VARIABLES, FORMULA_EXAMPLE } from "@/constants/pricingFormula";
import type { PricingRule, PricingRuleCreate } from "@/types/pricing";

const CATEGORY_LABELS: Record<string, string> = {
  exchange_rate: "سعر الصرف",
  freight: "الشحن",
  customs: "الجمارك",
  clearance: "التخليص",
  commission: "العمولة",
  discount: "الخصم",
  moq_discount: "خصم الكمية",
  tax: "الضريبة",
  margin: "هامش الربح",
  other: "أخرى",
};

const RULE_TYPE_LABELS: Record<string, string> = {
  percentage: "نسبة مئوية",
  fixed: "قيمة ثابتة",
  formula: "معادلة",
};

function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const backendMessage = err.response?.data?.error?.message;
    if (typeof backendMessage === "string") return backendMessage;
  }
  return err instanceof Error ? err.message : fallback;
}

function RuleFormModal({
  rule,
  onClose,
}: {
  rule?: PricingRule;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<PricingRuleCreate>({
    name: rule?.name || "",
    description: rule?.description || "",
    category: rule?.category || "other",
    rule_type: (rule?.rule_type as "percentage" | "fixed" | "formula") || "percentage",
    value: rule?.value || 0,
    formula: rule?.formula || "",
    currency: rule?.currency || "USD",
    priority: rule?.priority || 0,
    is_active: rule?.is_active ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: PricingRuleCreate) => pricingService.createRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing-rules"] });
      onClose();
    },
    onError: (err) => setError(extractApiErrorMessage(err, "فشل حفظ القاعدة")),
  });

  const updateMutation = useMutation({
    mutationFn: (data: PricingRuleCreate) => pricingService.updateRule(rule!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing-rules"] });
      onClose();
    },
    onError: (err) => setError(extractApiErrorMessage(err, "فشل حفظ القاعدة")),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError("يرجى إدخال اسم القاعدة");
      return;
    }

    if (formData.rule_type === "formula" && !formData.formula?.trim()) {
      setError("يرجى إدخال المعادلة");
      return;
    }

    const payload: PricingRuleCreate = {
      ...formData,
      formula: formData.rule_type === "formula" ? formData.formula : null,
    };

    if (rule) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const insertVariable = (name: string) => {
    setFormData((p) => ({ ...p, formula: `${p.formula || ""}${name}` }));
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {rule ? "تعديل قاعدة تسعير" : "إضافة قاعدة تسعير"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">الاسم</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">الوصف</label>
            <textarea
              value={formData.description || ""}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">التصنيف</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">النوع</label>
              <select
                value={formData.rule_type}
                onChange={(e) => setFormData((p) => ({ ...p, rule_type: e.target.value as any }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              >
                {Object.entries(RULE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {formData.rule_type === "formula" ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">المعادلة</label>
              <textarea
                value={formData.formula || ""}
                onChange={(e) => setFormData((p) => ({ ...p, formula: e.target.value }))}
                dir="ltr"
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-primary-500 focus:outline-none"
                placeholder={FORMULA_EXAMPLE}
              />
              <p className="mt-1 text-xs text-gray-400">
                مثال: <code dir="ltr">{FORMULA_EXAMPLE}</code> — تُحسب لكل سطر منتج على حدة
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {FORMULA_VARIABLES.map((v) => (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => insertVariable(v.name)}
                    title={v.label}
                    className="rounded-md bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700 transition-colors hover:bg-gray-200"
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">القيمة</label>
              <input
                type="number"
                step="0.01"
                value={formData.value}
                onChange={(e) => setFormData((p) => ({ ...p, value: parseFloat(e.target.value) || 0 }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                required
              />
              <p className="mt-1 text-xs text-gray-400">
                {formData.rule_type === "percentage"
                  ? "٪ تُحتسب من إجمالي قيمة البضاعة (للقواعد المخصصة)"
                  : "مبلغ ثابت يُضاف مرة واحدة لكل شحنة"}
              </p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">الأولوية</label>
            <input
              type="number"
              value={formData.priority}
              onChange={(e) => setFormData((p) => ({ ...p, priority: parseInt(e.target.value) || 0 }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData((p) => ({ ...p, is_active: e.target.checked }))}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="is_active" className="text-sm text-gray-700">نشط</label>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              {isPending ? "جاري الحفظ..." : rule ? "تحديث" : "إضافة"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PricingRulesPage() {
  const role = useAuthStore((s) => s.role);
  const isAdmin = role === "admin";
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);

  const { data, isLoading, error } = useQuery({
    queryKey: ["pricing-rules", categoryFilter],
    queryFn: () => pricingService.listRules({ category: categoryFilter }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pricingService.deleteRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing-rules"] });
    },
  });

  const handleAdd = () => {
    setEditingRule(undefined);
    setShowModal(true);
  };

  const handleEdit = (rule: PricingRule) => {
    setEditingRule(rule);
    setShowModal(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">قواعد التسعير</h1>
            <p className="mt-1 text-sm text-gray-500">إدارة قواعد واحتساب التكاليف</p>
          </div>
        </div>
        <div className="card p-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          <p className="mt-4 text-sm text-gray-500">جاري تحميل قواعد التسعير...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">قواعد التسعير</h1>
            <p className="mt-1 text-sm text-gray-500">إدارة قواعد واحتساب التكاليف</p>
          </div>
        </div>
        <div className="card p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-medium text-gray-600">خطأ في تحميل البيانات</h3>
          <p className="mt-2 text-sm text-red-500">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

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
            onClick={handleAdd}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
          >
            + إضافة قاعدة
          </button>
        )}
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategoryFilter(undefined)}
          className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
            !categoryFilter ? "bg-primary-100 text-primary-700 font-medium" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          الكل
        </button>
        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setCategoryFilter(k)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              categoryFilter === k ? "bg-primary-100 text-primary-700 font-medium" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {data && data.items.length === 0 && (
        <div className="card p-12 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-600">لا توجد قواعد تسعير</h3>
          <p className="mt-2 text-sm text-gray-400">
            {isAdmin ? "لم يتم إضافة أي قواعد تسعير بعد. اضغط على 'إضافة قاعدة' للبدء." : "لا توجد قواعد تسعير متاحة."}
          </p>
        </div>
      )}

      {/* Rules Table */}
      {data && data.items.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">الاسم</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">التصنيف</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">النوع</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">القيمة</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">الأولوية</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">الحالة</th>
                  {isAdmin && <th className="px-4 py-3 text-sm font-medium text-gray-500">الإجراءات</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((rule: PricingRule) => (
                  <tr key={rule.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {rule.name}
                      {rule.description && (
                        <p className="text-xs text-gray-400">{rule.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {CATEGORY_LABELS[rule.category] || rule.category}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {RULE_TYPE_LABELS[rule.rule_type] || rule.rule_type}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {rule.rule_type === "formula" ? (
                        <code dir="ltr" title={rule.formula ?? ""} className="font-mono text-xs text-gray-700">
                          {(rule.formula ?? "").length > 30
                            ? `${(rule.formula ?? "").slice(0, 30)}…`
                            : rule.formula}
                        </code>
                      ) : rule.rule_type === "percentage" ? (
                        `${rule.value}%`
                      ) : (
                        `${rule.value} ${rule.currency || ""}`
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{rule.priority}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        rule.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {rule.is_active ? "نشط" : "غير نشط"}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(rule)}
                            className="rounded-md bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-100"
                          >
                            تعديل
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("هل أنت متأكد من حذف هذه القاعدة؟")) {
                                deleteMutation.mutate(rule.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            className="rounded-md bg-red-50 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <RuleFormModal
          rule={editingRule}
          onClose={() => {
            setShowModal(false);
            setEditingRule(undefined);
          }}
        />
      )}
    </div>
  );
}
