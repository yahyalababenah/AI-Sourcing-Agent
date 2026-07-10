import { X } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FilterState {
  category: string;
  minPrice: string;
  maxPrice: string;
  supplierId: string;
}

interface SupplierOption {
  id: string;
  name: string;
}

interface CategoryOption {
  value: string;
  label: string;
}

interface CatalogFiltersProps {
  suppliers: SupplierOption[];
  categories: CategoryOption[];
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onReset: () => void;
  isOpen: boolean;
  onToggle: () => void;
  /** "sidebar" (always-visible, sticky column — MarketplacePageDesktop) or
   * "overlay" (slide-over triggered by a "فلاتر" button — Mobile). Each page
   * file renders only the variant it needs instead of both being mounted
   * behind a `hidden lg:block`/`lg:hidden` CSS toggle, per CLAUDE.md's rule
   * against single-file responsive toggling. */
  variant: "sidebar" | "overlay";
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CatalogFilters({
  suppliers,
  categories,
  filters,
  onChange,
  onReset,
  isOpen,
  onToggle,
  variant,
}: CatalogFiltersProps) {
  const update = (patch: Partial<FilterState>) => {
    onChange({ ...filters, ...patch });
  };

  const hasActiveFilters =
    filters.category !== "" ||
    filters.minPrice !== "" ||
    filters.maxPrice !== "" ||
    filters.supplierId !== "";

  // ─── Sidebar content (shared between desktop and mobile) ────────────
  const sidebarContent = (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-gray-900">الفلاتر</h3>
        {variant === "overlay" && (
          <button
            onClick={onToggle}
            className="rounded-lg p-1 text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-600 active:scale-[0.98]"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Category */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-500 uppercase tracking-wide">
          الفئة
        </label>
        <select
          value={filters.category}
          onChange={(e) => update({ category: e.target.value })}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        >
          <option value="">جميع الفئات</option>
          {categories.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Price Range */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-500 uppercase tracking-wide">
          السعر (RMB)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            placeholder="الحد الأدنى"
            value={filters.minPrice}
            onChange={(e) => update({ minPrice: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-gray-400">—</span>
          <input
            type="number"
            min={0}
            placeholder="الحد الأقصى"
            value={filters.maxPrice}
            onChange={(e) => update({ maxPrice: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>

      {/* Supplier */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-500 uppercase tracking-wide">
          المورد
        </label>
        <select
          value={filters.supplierId}
          onChange={(e) => update({ supplierId: e.target.value })}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        >
          <option value="">جميع الموردين</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <button
          onClick={onReset}
          disabled={!hasActiveFilters}
          className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          إعادة تعيين
        </button>
      </div>
    </div>
  );

  if (variant === "sidebar") {
    return (
      <aside className="w-64 shrink-0">
        <div className="sticky top-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {sidebarContent}
        </div>
      </aside>
    );
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onToggle} />
      <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl">
        <div className="h-full overflow-y-auto p-5">{sidebarContent}</div>
      </div>
    </div>
  );
}
