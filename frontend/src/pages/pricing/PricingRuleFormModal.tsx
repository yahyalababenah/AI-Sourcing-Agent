import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { pricingService } from "@/services/pricingService";
import { FORMULA_VARIABLES, FORMULA_EXAMPLE } from "@/constants/pricingFormula";
import type { PricingRule, PricingRuleCreate } from "@/types/pricing";
import { CATEGORY_LABELS, RULE_TYPE_LABELS } from "./usePricingRulesData";

function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const backendMessage = err.response?.data?.error?.message;
    if (typeof backendMessage === "string") return backendMessage;
  }
  return err instanceof Error ? err.message : fallback;
}

// Shared create/edit form — used by both PricingRulesPageDesktop and Mobile,
// same content just recolored to the slate/emerald admin palette.
export function PricingRuleFormModal({ rule, onClose }: { rule?: PricingRule; onClose: () => void }) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          {rule ? "تعديل قاعدة تسعير" : "إضافة قاعدة تسعير"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الاسم</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الوصف</label>
            <textarea
              value={formData.description || ""}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">التصنيف</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-500 focus:outline-none"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">النوع</label>
              <select
                value={formData.rule_type}
                onChange={(e) => setFormData((p) => ({ ...p, rule_type: e.target.value as any }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-500 focus:outline-none"
              >
                {Object.entries(RULE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {formData.rule_type === "formula" ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">المعادلة</label>
              <textarea
                value={formData.formula || ""}
                onChange={(e) => setFormData((p) => ({ ...p, formula: e.target.value }))}
                dir="ltr"
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm focus:border-slate-500 focus:outline-none"
                placeholder={FORMULA_EXAMPLE}
              />
              <p className="mt-1 text-xs text-slate-400">
                مثال: <code dir="ltr">{FORMULA_EXAMPLE}</code> — تُحسب لكل سطر منتج على حدة
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {FORMULA_VARIABLES.map((v) => (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => insertVariable(v.name)}
                    title={v.label}
                    className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700 transition-colors duration-150 hover:bg-slate-200"
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">القيمة</label>
              <input
                type="number"
                step="0.01"
                value={formData.value}
                onChange={(e) => setFormData((p) => ({ ...p, value: parseFloat(e.target.value) || 0 }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-500 focus:outline-none"
                required
              />
              <p className="mt-1 text-xs text-slate-400">
                {formData.rule_type === "percentage"
                  ? "٪ تُحتسب من إجمالي قيمة البضاعة (للقواعد المخصصة)"
                  : "مبلغ ثابت يُضاف مرة واحدة لكل شحنة"}
              </p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الأولوية</label>
            <input
              type="number"
              value={formData.priority}
              onChange={(e) => setFormData((p) => ({ ...p, priority: parseInt(e.target.value) || 0 }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData((p) => ({ ...p, is_active: e.target.checked }))}
              className="rounded border-slate-300 text-slate-700 focus:ring-slate-500"
            />
            <label htmlFor="is_active" className="text-sm text-slate-700">نشط</label>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-slate-900 active:scale-[0.98] disabled:opacity-50"
            >
              {isPending ? "جاري الحفظ..." : rule ? "تحديث" : "إضافة"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-all duration-150 hover:bg-slate-50 active:scale-[0.98]"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
