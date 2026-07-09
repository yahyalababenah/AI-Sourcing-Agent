import { ReceiptText } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { GlossaryTerm } from "@/components/ui/GlossaryTerm";
import { HSCodeFormModal } from "./HSCodeFormModal";
import { useHsCodeSchedulesData } from "./useHsCodeSchedulesData";

// No handoff-designs/*.html reference exists for HS-code fee schedules —
// stacked cards per CLAUDE.md's mandatory mobile pattern (9 table columns
// don't fit a narrow viewport), same data/actions as the desktop table.
export function AdminHSCodeSchedulesPageMobile() {
  const {
    entries,
    total,
    isLoading,
    error,
    showModal,
    editingEntry,
    handleAdd,
    handleEdit,
    handleDelete,
    closeModal,
    deleteMutation,
  } = useHsCodeSchedulesData();

  return (
    <div className="space-y-4 pb-8">
      <div className="card space-y-3 p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white">
            <ReceiptText className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">جداول رسوم رموز HS</h1>
            <p className="text-xs text-slate-500">{total} رمز HS مسجّل</p>
          </div>
        </div>
        <button
          onClick={handleAdd}
          className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-slate-900 active:scale-[0.98]"
        >
          + إضافة رمز HS
        </button>
      </div>

      {isLoading && (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card space-y-2 p-4">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-3 w-40 rounded" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && error && (
        <EmptyState icon={ReceiptText} title="خطأ في تحميل البيانات" description={error.message} />
      )}

      {!isLoading && !error && entries.length === 0 && (
        <EmptyState
          icon={ReceiptText}
          title="لا توجد رموز HS مضافة بعد"
          description={
            'اضغط على "إضافة رمز HS" لإضافة أول جدول رسوم. لا تُدخل أرقاماً غير موثقة.'
          }
        />
      )}

      {!isLoading &&
        !error &&
        entries.map((entry) => (
          <div key={entry.id} className="card space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800" dir="ltr">
                  {entry.hs_code}
                </p>
                {entry.description && <p className="truncate text-xs text-slate-400">{entry.description}</p>}
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                  entry.is_verified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                )}
              >
                {entry.is_verified ? "✅ مؤكد" : "⚠️ تقديري"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-500 tabular-nums" dir="ltr">
              <span><GlossaryTerm term="Duty001">001</GlossaryTerm>: {entry.duty_rate_001}%</span>
              <span><GlossaryTerm term="Service301">301</GlossaryTerm>: {entry.service_flat_fee_301} JOD</span>
              <span><GlossaryTerm term="Service070">070</GlossaryTerm>: {entry.service_percent_070}%</span>
              <span><GlossaryTerm term="Penalty018">018</GlossaryTerm>: {entry.requires_license ? `${entry.penalty_rate_018}%` : "—"}</span>
              <span><GlossaryTerm term="VAT020">020</GlossaryTerm>: {entry.vat_rate_020 ?? "16 (افتراضي)"}</span>
              <span><GlossaryTerm term="License">ترخيص</GlossaryTerm>: {entry.requires_license ? "نعم" : "لا"}</span>
            </div>

            <div className="flex gap-2 border-t border-slate-100 pt-3">
              <button
                onClick={() => handleEdit(entry)}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-all duration-150 hover:bg-slate-50 active:scale-[0.98]"
              >
                تعديل
              </button>
              <button
                onClick={() => handleDelete(entry)}
                disabled={deleteMutation.isPending}
                className="flex-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-all duration-150 hover:bg-red-50 active:scale-[0.98] disabled:opacity-50"
              >
                حذف
              </button>
            </div>
          </div>
        ))}

      {showModal && <HSCodeFormModal entry={editingEntry} onClose={closeModal} />}
    </div>
  );
}
