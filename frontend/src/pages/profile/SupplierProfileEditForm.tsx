import { Loader2, Save, X } from "lucide-react";

interface SupplierProfileEditFormProps {
  form: { full_name: string; factory_name: string; location_in_china: string; specialty: string; factory_address: string; phone: string };
  onChange: (
    key: "full_name" | "factory_name" | "location_in_china" | "specialty" | "factory_address" | "phone",
    value: string,
  ) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 transition-colors duration-150 focus:border-supplier-400 focus:bg-white focus:outline-none"
      />
    </div>
  );
}

// Inline edit panel opened by "تعديل الملف" on the supplier profile — same
// PATCH /auth/me contract as the legacy ProfilePage form and
// ClientProfileEditForm, restyled with supplier-* tokens.
export function SupplierProfileEditForm({ form, onChange, onSave, onCancel, isSaving }: SupplierProfileEditFormProps) {
  return (
    <div className="card space-y-4 p-5">
      <h2 className="text-sm font-semibold text-slate-900">تعديل الملف الشخصي</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="اسم المندوب" value={form.full_name} onChange={(v) => onChange("full_name", v)} />
        <Field label="رقم الهاتف" value={form.phone} onChange={(v) => onChange("phone", v)} placeholder="+962791234567" />
      </div>

      <h3 className="pt-1 text-xs font-semibold text-slate-500">المصنع الذي أمثّله</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="اسم المصنع" value={form.factory_name} onChange={(v) => onChange("factory_name", v)} />
        <Field
          label="الموقع في الصين"
          value={form.location_in_china}
          onChange={(v) => onChange("location_in_china", v)}
          placeholder="Guangzhou, Guangdong"
        />
        <Field
          label="التخصص"
          value={form.specialty}
          onChange={(v) => onChange("specialty", v)}
          placeholder="الإلكترونيات، المعدات الصناعية..."
        />
        <Field label="عنوان المصنع" value={form.factory_address} onChange={(v) => onChange("factory_address", v)} />
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-50 active:scale-[0.98]"
        >
          <X className="h-3.5 w-3.5" />
          إلغاء
        </button>
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 rounded-lg bg-supplier-500 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-supplier-600 active:scale-[0.98] disabled:opacity-60"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          حفظ التغييرات
        </button>
      </div>
    </div>
  );
}
