import { PRODUCT_CATEGORIES } from "@/constants/categories";

interface AdminCatalogEditFieldsProps {
  form: Record<string, string | number>;
  onChange: (form: Record<string, string | number>) => void;
}

// Shared "correct the AI extraction" field grid — used by both
// AdminCatalogPageDesktop and Mobile, same fields ProductReviewPage exposes
// to agents (product_name/model_number/unit_price_rmb/moq/material/category).
export function AdminCatalogEditFields({ form, onChange }: AdminCatalogEditFieldsProps) {
  const set = (key: string, value: string) => onChange({ ...form, [key]: value });

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div>
        <label className="mb-1 block text-[11px] text-slate-500">اسم المنتج</label>
        <input
          type="text"
          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
          value={String(form.product_name ?? "")}
          onChange={(e) => set("product_name", e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-[11px] text-slate-500">رقم الموديل</label>
        <input
          type="text"
          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
          value={String(form.model_number ?? "")}
          onChange={(e) => set("model_number", e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-[11px] text-slate-500">السعر (RMB)</label>
        <input
          type="number"
          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
          value={String(form.unit_price_rmb ?? "")}
          onChange={(e) => set("unit_price_rmb", e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-[11px] text-slate-500">الحد الأدنى للطلب</label>
        <input
          type="number"
          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
          value={String(form.moq ?? "")}
          onChange={(e) => set("moq", e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-[11px] text-slate-500">الخامة</label>
        <input
          type="text"
          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
          value={String(form.material ?? "")}
          onChange={(e) => set("material", e.target.value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-[11px] text-slate-500">الفئة</label>
        <select
          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
          value={String(form.category ?? "")}
          onChange={(e) => set("category", e.target.value)}
        >
          <option value="">—</option>
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
