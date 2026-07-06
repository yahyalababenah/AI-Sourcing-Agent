import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { pricingService } from "@/services/pricingService";
import type { HSCodeFeeSchedule, HSCodeFeeScheduleCreate } from "@/types/pricing";

function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const backendMessage = err.response?.data?.error?.message;
    if (typeof backendMessage === "string") return backendMessage;
  }
  return err instanceof Error ? err.message : fallback;
}

// Shared create/edit form — used by both AdminHSCodeSchedulesPageDesktop and
// Mobile, same content just recolored to the slate/emerald admin palette.
export function HSCodeFormModal({ entry, onClose }: { entry?: HSCodeFeeSchedule; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<HSCodeFeeScheduleCreate>({
    hs_code: entry?.hs_code || "",
    description: entry?.description || "",
    duty_rate_001: entry?.duty_rate_001 ?? 0,
    service_flat_fee_301: entry?.service_flat_fee_301 ?? 0,
    service_percent_070: entry?.service_percent_070 ?? 0,
    requires_license: entry?.requires_license ?? false,
    penalty_rate_018: entry?.penalty_rate_018 ?? 0,
    vat_rate_020: entry?.vat_rate_020 ?? null,
    is_verified: entry?.is_verified ?? false,
    source_note: entry?.source_note || "",
  });
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: HSCodeFeeScheduleCreate) => pricingService.createHsCode(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hs-code-schedules"] });
      onClose();
    },
    onError: (err) => setError(extractApiErrorMessage(err, "فشل حفظ الرمز")),
  });

  const updateMutation = useMutation({
    mutationFn: (data: HSCodeFeeScheduleCreate) => pricingService.updateHsCode(entry!.hs_code, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hs-code-schedules"] });
      onClose();
    },
    onError: (err) => setError(extractApiErrorMessage(err, "فشل حفظ الرمز")),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.hs_code.trim()) {
      setError("يرجى إدخال رمز HS");
      return;
    }
    if (!/^\d{6,12}$/.test(formData.hs_code.trim())) {
      setError("رمز HS يجب أن يكون من 6 إلى 12 رقماً");
      return;
    }
    if (
      formData.duty_rate_001 > 100 ||
      formData.service_percent_070 > 100 ||
      formData.penalty_rate_018 > 100 ||
      (formData.vat_rate_020 !== null && formData.vat_rate_020 !== undefined && formData.vat_rate_020 > 100)
    ) {
      setError("النسبة يجب ألا تتجاوز 100٪");
      return;
    }

    if (entry) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          {entry ? "تعديل جدول رسوم رمز HS" : "إضافة جدول رسوم رمز HS"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">رمز HS</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6,12}"
              value={formData.hs_code}
              onChange={(e) => setFormData((p) => ({ ...p, hs_code: e.target.value }))}
              disabled={!!entry}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none disabled:bg-slate-100"
              placeholder="مثال: 85241210000"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الوصف</label>
            <textarea
              value={formData.description || ""}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">رسوم 001 (% على CIF)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={formData.duty_rate_001}
                onChange={(e) => setFormData((p) => ({ ...p, duty_rate_001: parseFloat(e.target.value) || 0 }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">بدل خدمات 301 (JOD ثابت)</label>
              <input
                type="number"
                step="0.01"
                value={formData.service_flat_fee_301}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, service_flat_fee_301: parseFloat(e.target.value) || 0 }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">بدل خدمات 070 (% على CIF)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={formData.service_percent_070}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, service_percent_070: parseFloat(e.target.value) || 0 }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">غرامة 018 الشرطية (% على CIF)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={formData.penalty_rate_018}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, penalty_rate_018: parseFloat(e.target.value) || 0 }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              ضريبة المبيعات 020 (٪) — اتركه فارغاً للافتراضي 16٪
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              max={100}
              value={formData.vat_rate_020 ?? ""}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  vat_rate_020: e.target.value === "" ? null : parseFloat(e.target.value) || 0,
                }))
              }
              placeholder="16"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="requires_license"
              checked={formData.requires_license}
              onChange={(e) => setFormData((p) => ({ ...p, requires_license: e.target.checked }))}
              className="rounded border-slate-300 text-slate-700 focus:ring-slate-500"
            />
            <label htmlFor="requires_license" className="text-sm text-slate-700">
              يتطلب ترخيص / شهادة مطابقة (تُطبَّق غرامة 018 إن لم يُؤكَّد توفره)
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_verified"
              checked={formData.is_verified}
              onChange={(e) => setFormData((p) => ({ ...p, is_verified: e.target.checked }))}
              className="rounded border-slate-300 text-slate-700 focus:ring-slate-500"
            />
            <label htmlFor="is_verified" className="text-sm text-slate-700">
              مؤكد من محاكاة JCAP حقيقية (وإلا يُعتبر تقديرياً)
            </label>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">مصدر البيانات</label>
            <input
              type="text"
              value={formData.source_note || ""}
              onChange={(e) => setFormData((p) => ({ ...p, source_note: e.target.value }))}
              placeholder="مثال: نتيجة محاكاة ضريبية حقيقية على JCAP بتاريخ ..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>

          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-slate-900 active:scale-[0.98] disabled:opacity-50"
            >
              {isPending ? "جاري الحفظ..." : entry ? "تحديث" : "إضافة"}
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
