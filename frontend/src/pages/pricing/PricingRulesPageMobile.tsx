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
        {formula.length > 24 ? `${formula.slice(0, 24)}…` : formula}
      </code>
    );
  }
  if (rule.rule_type === "percentage") return `${rule.value}%`;
  return `${rule.value} ${rule.currency || ""}`;
}

// No handoff-designs/*.html reference exists for pricing rules — stacked
// cards per CLAUDE.md's mandatory mobile pattern, same data/actions as
// the desktop table.
export function PricingRulesPageMobile() {
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
    <div className="space-y-4 pb-8">
      <div className="card space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">قواعد التسعير</h1>
              <p className="text-xs text-slate-500">{total} قاعدة مسجّلة</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleAdd}
          className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-slate-900 active:scale-[0.98]"
        >
          + إضافة قاعدة
        </button>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto">
        <button
          onClick={() => setCategoryFilter(undefined)}
          className={cn(
            "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-150",
            !categoryFilter ? "bg-slate-800 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
          )}
        >
          الكل
        </button>
        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setCategoryFilter(k)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-150",
              categoryFilter === k ? "bg-slate-800 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
            )}
          >
            {v}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card space-y-2 p-4">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-3 w-44 rounded" />
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

      {!isLoading &&
        !error &&
        rules.map((rule) => (
          <div key={rule.id} className="card space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{rule.name}</p>
                {rule.description && <p className="truncate text-xs text-slate-400">{rule.description}</p>}
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                  rule.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                )}
              >
                {rule.is_active ? "نشط" : "غير نشط"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span>{CATEGORY_LABELS[rule.category] || rule.category}</span>
              <span>{RULE_TYPE_LABELS[rule.rule_type] || rule.rule_type}</span>
              <span className="tabular-nums">{formatValue(rule)}</span>
              <span className="tabular-nums">أولوية: {rule.priority}</span>
            </div>

            <div className="flex gap-2 border-t border-slate-100 pt-3">
              <button
                onClick={() => handleEdit(rule)}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-all duration-150 hover:bg-slate-50 active:scale-[0.98]"
              >
                تعديل
              </button>
              <button
                onClick={() => handleDelete(rule)}
                disabled={deleteMutation.isPending}
                className="flex-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-all duration-150 hover:bg-red-50 active:scale-[0.98] disabled:opacity-50"
              >
                حذف
              </button>
            </div>
          </div>
        ))}

      {showModal && <PricingRuleFormModal rule={editingRule} onClose={closeModal} />}
    </div>
  );
}
