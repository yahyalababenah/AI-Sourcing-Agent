import { ReceiptText } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { HSCodeFormModal } from "./HSCodeFormModal";
import { useHsCodeSchedulesData } from "./useHsCodeSchedulesData";

export function AdminHSCodeSchedulesPageDesktop() {
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
    <div className="space-y-5 pb-8">
      <div className="card flex items-center justify-between p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-white">
            <ReceiptText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">جداول رسوم رموز HS</h1>
            <p className="text-sm text-slate-500">
              {total} رمز HS — الرسوم متعددة البنود (001 الجمرك، 301 بدل خدمات ثابت، 070 بدل خدمات
              نسبي، 018 غرامة شرطية)
            </p>
          </div>
        </div>
        <button
          onClick={handleAdd}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-slate-900 active:scale-[0.98]"
        >
          + إضافة رمز HS
        </button>
      </div>

      {isLoading && (
        <div className="card divide-y divide-slate-50 p-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
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
            'اضغط على "إضافة رمز HS" لإضافة أول جدول رسوم. لا تُدخل أرقاماً غير موثقة — اترك الحقل فارغاً حتى تتوفر بيانات حقيقية من محاكاة JCAP.'
          }
        />
      )}

      {!isLoading && !error && entries.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400">
                  <th className="px-4 py-3 text-start font-medium">رمز HS</th>
                  <th className="px-4 py-3 text-start font-medium">001 (%)</th>
                  <th className="px-4 py-3 text-start font-medium">301 (JOD)</th>
                  <th className="px-4 py-3 text-start font-medium">070 (%)</th>
                  <th className="px-4 py-3 text-start font-medium">ترخيص؟</th>
                  <th className="px-4 py-3 text-start font-medium">018 (%)</th>
                  <th className="px-4 py-3 text-start font-medium">020 (%)</th>
                  <th className="px-4 py-3 text-start font-medium">الحالة</th>
                  <th className="px-4 py-3 text-end font-medium">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {entries.map((entry) => (
                  <tr key={entry.id} className="transition-colors duration-150 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {entry.hs_code}
                      {entry.description && <p className="text-xs text-slate-400">{entry.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 tabular-nums" dir="ltr">
                      {entry.duty_rate_001}%
                    </td>
                    <td className="px-4 py-3 text-slate-500 tabular-nums" dir="ltr">
                      {entry.service_flat_fee_301}
                    </td>
                    <td className="px-4 py-3 text-slate-500 tabular-nums" dir="ltr">
                      {entry.service_percent_070}%
                    </td>
                    <td className="px-4 py-3 text-slate-500">{entry.requires_license ? "نعم" : "لا"}</td>
                    <td className="px-4 py-3 text-slate-500 tabular-nums" dir="ltr">
                      {entry.requires_license ? `${entry.penalty_rate_018}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 tabular-nums" dir="ltr">
                      {entry.vat_rate_020 ?? "16 (افتراضي)"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                          entry.is_verified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        )}
                        title={entry.source_note || undefined}
                      >
                        {entry.is_verified ? "✅ مؤكد" : "⚠️ تقديري"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(entry)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-all duration-150 hover:bg-slate-50 active:scale-[0.98]"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => handleDelete(entry)}
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
        </div>
      )}

      {showModal && <HSCodeFormModal entry={editingEntry} onClose={closeModal} />}
    </div>
  );
}
