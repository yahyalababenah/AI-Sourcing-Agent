import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pricingService } from "@/services/pricingService";
import type { HSCodeFeeSchedule, HSCodeFeeScheduleCreate } from "@/types/pricing";

function HSCodeFormModal({
  entry,
  onClose,
}: {
  entry?: HSCodeFeeSchedule;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<HSCodeFeeScheduleCreate>({
    hs_code: entry?.hs_code || "",
    description: entry?.description || "",
    duty_rate_001: entry?.duty_rate_001 ?? 0,
    service_flat_fee_301: entry?.service_flat_fee_301 ?? 0,
    service_percent_070: entry?.service_percent_070 ?? 0,
    requires_license: entry?.requires_license ?? false,
    penalty_rate_018: entry?.penalty_rate_018 ?? 0,
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
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: HSCodeFeeScheduleCreate) =>
      pricingService.updateHsCode(entry!.hs_code, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hs-code-schedules"] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.hs_code.trim()) {
      setError("يرجى إدخال رمز HS");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {entry ? "تعديل جدول رسوم رمز HS" : "إضافة جدول رسوم رمز HS"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">رمز HS</label>
            <input
              type="text"
              value={formData.hs_code}
              onChange={(e) => setFormData((p) => ({ ...p, hs_code: e.target.value }))}
              disabled={!!entry}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none disabled:bg-gray-100"
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
              <label className="mb-1 block text-sm font-medium text-gray-700">
                رسوم 001 (% على CIF)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.duty_rate_001}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, duty_rate_001: parseFloat(e.target.value) || 0 }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                بدل خدمات 301 (JOD ثابت)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.service_flat_fee_301}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    service_flat_fee_301: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                بدل خدمات 070 (% على CIF)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.service_percent_070}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    service_percent_070: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                غرامة 018 الشرطية (% على CIF)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.penalty_rate_018}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    penalty_rate_018: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="requires_license"
              checked={formData.requires_license}
              onChange={(e) =>
                setFormData((p) => ({ ...p, requires_license: e.target.checked }))
              }
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="requires_license" className="text-sm text-gray-700">
              يتطلب ترخيص / شهادة مطابقة (تُطبَّق غرامة 018 إن لم يُؤكَّد توفره)
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_verified"
              checked={formData.is_verified}
              onChange={(e) => setFormData((p) => ({ ...p, is_verified: e.target.checked }))}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="is_verified" className="text-sm text-gray-700">
              مؤكد من محاكاة JCAP حقيقية (وإلا يُعتبر تقديرياً)
            </label>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              مصدر البيانات
            </label>
            <input
              type="text"
              value={formData.source_note || ""}
              onChange={(e) => setFormData((p) => ({ ...p, source_note: e.target.value }))}
              placeholder="مثال: نتيجة محاكاة ضريبية حقيقية على JCAP بتاريخ ..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
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
              {isPending ? "جاري الحفظ..." : entry ? "تحديث" : "إضافة"}
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

export function AdminHSCodeSchedulesPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<HSCodeFeeSchedule | undefined>(undefined);

  const { data, isLoading, error } = useQuery({
    queryKey: ["hs-code-schedules"],
    queryFn: () => pricingService.listHsCodes(),
  });

  const deleteMutation = useMutation({
    mutationFn: (code: string) => pricingService.deleteHsCode(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hs-code-schedules"] });
    },
  });

  const handleAdd = () => {
    setEditingEntry(undefined);
    setShowModal(true);
  };

  const handleEdit = (entry: HSCodeFeeSchedule) => {
    setEditingEntry(entry);
    setShowModal(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">جداول رسوم رموز HS</h1>
          <p className="mt-1 text-sm text-gray-500">إدارة الرسوم الجمركية متعددة البنود لكل رمز HS</p>
        </div>
        <div className="card p-12 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          <p className="mt-4 text-sm text-gray-500">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">جداول رسوم رموز HS</h1>
        </div>
        <div className="card p-12 text-center">
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
          <h1 className="text-2xl font-bold text-gray-900">جداول رسوم رموز HS</h1>
          <p className="mt-1 text-sm text-gray-500">
            إدارة الرسوم الجمركية متعددة البنود (001 الجمرك، 301 بدل خدمات ثابت، 070
            بدل خدمات نسبي، 018 غرامة شرطية) لكل رمز HS
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          + إضافة رمز HS
        </button>
      </div>

      {data && data.items.length === 0 && (
        <div className="card p-12 text-center">
          <h3 className="mt-4 text-lg font-medium text-gray-600">لا توجد رموز HS مضافة بعد</h3>
          <p className="mt-2 text-sm text-gray-400">
            اضغط على "إضافة رمز HS" لإضافة أول جدول رسوم. لا تُدخل أرقاماً غير موثقة —
            اترك الحقل فارغاً حتى تتوفر بيانات حقيقية من محاكاة JCAP.
          </p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">رمز HS</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">001 (%)</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">301 (JOD)</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">070 (%)</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">ترخيص؟</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">018 (%)</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">الحالة</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-500">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((entry: HSCodeFeeSchedule) => (
                  <tr key={entry.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {entry.hs_code}
                      {entry.description && (
                        <p className="text-xs text-gray-400">{entry.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600" dir="ltr">
                      {entry.duty_rate_001}%
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600" dir="ltr">
                      {entry.service_flat_fee_301}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600" dir="ltr">
                      {entry.service_percent_070}%
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {entry.requires_license ? "نعم" : "لا"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600" dir="ltr">
                      {entry.requires_license ? `${entry.penalty_rate_018}%` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          entry.is_verified
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                        title={entry.source_note || undefined}
                      >
                        {entry.is_verified ? "✅ مؤكد" : "⚠️ تقديري"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(entry)}
                          className="rounded-md bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-100"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من حذف رمز HS ${entry.hs_code}؟`)) {
                              deleteMutation.mutate(entry.hs_code);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="rounded-md bg-red-50 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
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

      {showModal && (
        <HSCodeFormModal
          entry={editingEntry}
          onClose={() => {
            setShowModal(false);
            setEditingEntry(undefined);
          }}
        />
      )}
    </div>
  );
}
