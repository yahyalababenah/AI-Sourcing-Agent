import { Loader2, Save, X } from "lucide-react";

interface ClientProfileEditFormProps {
  form: { company_name: string; preferred_port: string; contact_number: string; phone: string };
  onChange: (key: "company_name" | "preferred_port" | "contact_number" | "phone", value: string) => void;
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
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 transition-colors duration-150 focus:border-importer-400 focus:bg-white focus:outline-none"
      />
    </div>
  );
}

// Inline edit panel opened by "تعديل الملف" on the importer profile — reuses
// the same PATCH /auth/me contract as the old generic ProfilePage form
// (see useClientProfileData's saveMutation), just restyled with
// importer-* tokens instead of the legacy primary-*/gray-* theme.
export function ClientProfileEditForm({ form, onChange, onSave, onCancel, isSaving }: ClientProfileEditFormProps) {
  return (
    <div className="card space-y-4 p-5">
      <h2 className="text-sm font-semibold text-slate-900">تعديل بيانات الشركة</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="اسم الشركة" value={form.company_name} onChange={(v) => onChange("company_name", v)} />
        <Field
          label="ميناء الاستيراد المفضّل"
          value={form.preferred_port}
          onChange={(v) => onChange("preferred_port", v)}
          placeholder="Aqaba"
        />
        <Field
          label="رقم التواصل التجاري"
          value={form.contact_number}
          onChange={(v) => onChange("contact_number", v)}
        />
        <Field label="رقم الهاتف" value={form.phone} onChange={(v) => onChange("phone", v)} placeholder="+962791234567" />
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
          className="flex items-center gap-1.5 rounded-lg bg-importer-500 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-importer-600 active:scale-[0.98] disabled:opacity-60"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          حفظ التغييرات
        </button>
      </div>
    </div>
  );
}
