import { DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { PricingRuleFormModal } from "./PricingRuleFormModal";
import { usePricingRulesData, CATEGORY_LABELS, RULE_TYPE_LABELS } from "./usePricingRulesData";
import type { PricingRule } from "@/types/pricing";

function formatValue(rule: PricingRule) {
  if (rule.rule_type === "formula") {
    const formula = rule.formula ?? "";
    return (
      <code dir="ltr" title={formula} className="font-mono text-xs text-slate-600">
        {formula.length > 30 ? `${formula.slice(0, 30)}…` : formula}
      </code>
    );
  }
  if (rule.rule_type === "percentage") return `${rule.value}%`;
  return `${rule.value} ${rule.currency || ""}`;
}

export function PricingRulesPageDesktop() {
  const {
    rules,
    total,
    isLoading,
    error,
    categoryFilter,
    setCategoryFilter,
    showModal,
    editingRule,
    handleAdd,
    handleEdit,
    handleDelete,
    closeModal,
    deleteMutation,
  } = usePricingRulesData();

  return (
    <div className="space-y-5 pb-8">
      <div className="card flex items-center justify-between p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-white">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">قواعد التسعير</h1>
            <p className="text-sm text-slate-500">{total} قاعدة تسعير مسجّلة</p>
          </div>
        </div>
        <button
          onClick={handleAdd}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-slate-900 active:scale-[0.98]"
        >
          + إضافة قاعدة
        </button>
      </div>

      <div className="card flex flex-wrap gap-1.5 p-4">
        <button
          onClick={() => setCategoryFilter(undefined)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150",
            !categoryFilter ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50"
          )}
        >
          الكل
        </button>
        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setCategoryFilter(k)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150",
              categoryFilter === k ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50"
            )}
          >
            {v}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="card divide-y divide-slate-50 p-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && error && (
        <EmptyState icon={DollarSign} title="خطأ في تحميل البيانات" description={error.message} />
      )}

      {!isLoading && !error && rules.length === 0 && (
        <EmptyState
          icon={DollarSign}
          title="لا توجد قواعد تسعير"
          description="لم يتم إضافة أي قواعد تسعير بعد. اضغط على 'إضافة قاعدة' للبدء."
        />
      )}

      {!isLoading && !error && rules.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-start text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs text-slate-400">
                <th className="px-5 py-3 text-start font-medium">الاسم</th>
                <th className="px-5 py-3 text-start font-medium">التصنيف</th>
                <th className="px-5 py-3 text-start font-medium">النوع</th>
                <th className="px-5 py-3 text-start font-medium">القيمة</th>
                <th className="px-5 py-3 text-start font-medium">الأولوية</th>
                <th className="px-5 py-3 text-start font-medium">الحالة</th>
                <th className="px-5 py-3 text-end font-medium">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rules.map((rule) => (
                <tr key={rule.id} className="transition-colors duration-150 hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-800">
                    {rule.name}
                    {rule.description && <p className="text-xs text-slate-400">{rule.description}</p>}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{CATEGORY_LABELS[rule.category] || rule.category}</td>
                  <td className="px-5 py-3 text-slate-500">{RULE_TYPE_LABELS[rule.rule_type] || rule.rule_type}</td>
                  <td className="px-5 py-3 font-medium text-slate-800 tabular-nums">{formatValue(rule)}</td>
                  <td className="px-5 py-3 text-slate-500 tabular-nums">{rule.priority}</td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        rule.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      )}
                    >
                      {rule.is_active ? "نشط" : "غير نشط"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-end">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(rule)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-all duration-150 hover:bg-slate-50 active:scale-[0.98]"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => handleDelete(rule)}
                        disabled={deleteMutation.isPending}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-all duration-150 hover:bg-red-50 active:scale-[0.98] disabled:opacity-50"
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <PricingRuleFormModal rule={editingRule} onClose={closeModal} />}
    </div>
  );
}
