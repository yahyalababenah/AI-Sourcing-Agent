import { Search, X, Package, AlertCircle } from "lucide-react";
import { CatalogFilters } from "./CatalogFilters";
import { MarketplaceProductCard } from "./MarketplaceProductCard";
import { MarketplaceRfqModal } from "./MarketplaceRfqModal";
import { useMarketplaceData } from "./useMarketplaceData";
import { categoryLabel } from "@/constants/categories";

// Global marketplace, desktop layout (T8.5): always-visible sidebar filters
// (category/price/supplier — real, backend-supported params) + real active-
// filter chips (replacing the old page's purely decorative, non-functional
// chip row) + a 3-column product grid. Shared across all three roles (see
// RoleGuard on ROUTES.CATALOG.MARKETPLACE) — no role-specific coloring, uses
// brand-* per CLAUDE.md's rule for shared/neutral elements.
export function MarketplacePageDesktop() {
  const {
    searchQuery,
    setSearchQuery,
    page,
    setPage,
    totalPages,
    total,
    filters,
    setFilters,
    clearFilter,
    handleResetFilters,
    hasActiveFilters,
    uniqueSuppliers,
    categories,
    data,
    isLoading,
    isError,
    error,
    refetch,
    debouncedQuery,
    selectedProduct,
    handleRequestQuote,
    handleCloseModal,
  } = useMarketplaceData();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-slate-900">سوق الموردين</h1>
          <p className="mt-0.5 text-[11px] text-slate-500">240+ مورّد صيني في التجارة العابرة للحدود</p>
        </div>
        <div className="flex w-56 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث..."
            className="flex-1 bg-transparent text-[12px] text-slate-900 outline-none"
          />
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-500">الفلاتر النشطة:</span>
          {filters.category && (
            <button
              onClick={() => clearFilter("category")}
              className="flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-medium text-brand-600 transition-colors duration-150 hover:bg-brand-100"
            >
              {categoryLabel(filters.category)}
              <X className="h-3 w-3" />
            </button>
          )}
          {(filters.minPrice || filters.maxPrice) && (
            <button
              onClick={() => {
                clearFilter("minPrice");
                clearFilter("maxPrice");
              }}
              className="flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-medium text-brand-600 transition-colors duration-150 hover:bg-brand-100"
            >
              ¥{filters.minPrice || "0"} – {filters.maxPrice || "∞"}
              <X className="h-3 w-3" />
            </button>
          )}
          {filters.supplierId && (
            <button
              onClick={() => clearFilter("supplierId")}
              className="flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-medium text-brand-600 transition-colors duration-150 hover:bg-brand-100"
            >
              {uniqueSuppliers.find((s) => s.id === filters.supplierId)?.name ?? filters.supplierId}
              <X className="h-3 w-3" />
            </button>
          )}
          <button onClick={handleResetFilters} className="text-[11px] text-slate-400 underline hover:text-slate-600">
            مسح الكل
          </button>
        </div>
      )}

      <div className="flex gap-6">
        <CatalogFilters
          variant="sidebar"
          suppliers={uniqueSuppliers}
          categories={categories}
          filters={filters}
          onChange={setFilters}
          onReset={handleResetFilters}
          isOpen={false}
          onToggle={() => {}}
        />

        <div className="min-w-0 flex-1 space-y-6">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card animate-pulse overflow-hidden">
                  <div className="h-28 bg-slate-100" />
                  <div className="space-y-2 p-3">
                    <div className="h-4 rounded bg-slate-100" />
                    <div className="h-3 w-2/3 rounded bg-slate-100" />
                    <div className="mt-4 h-8 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="card flex flex-col items-center gap-3 p-12 text-center">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <p className="text-sm text-red-600">
                {error instanceof Error ? error.message : "فشل تحميل المنتجات. يرجى المحاولة لاحقاً."}
              </p>
              <button
                onClick={() => refetch()}
                className="rounded-lg border border-red-300 px-4 py-1.5 text-xs font-medium text-red-700 transition-colors duration-150 hover:bg-red-50"
              >
                إعادة المحاولة
              </button>
            </div>
          ) : data && data.items.length === 0 ? (
            <div className="card flex flex-col items-center gap-3 p-12 text-center">
              <Package className="h-12 w-12 text-slate-300" />
              <p className="text-base font-medium text-slate-600">
                {debouncedQuery || filters.category || filters.supplierId
                  ? "لا توجد منتجات تطابق بحثك"
                  : "لا توجد منتجات متاحة حالياً"}
              </p>
            </div>
          ) : data ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.items.map((product) => (
                  <MarketplaceProductCard key={product.id} product={product} onRequestQuote={handleRequestQuote} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition-colors duration-150 hover:bg-slate-50 disabled:opacity-40"
                  >
                    السابق
                  </button>
                  <span className="px-2 text-sm text-slate-500">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition-colors duration-150 hover:bg-slate-50 disabled:opacity-40"
                  >
                    التالي
                  </button>
                </div>
              )}

              <p className="text-center text-[11px] text-slate-400">
                إجمالي {total} منتج — الصفحة {page} من {totalPages}
              </p>
            </>
          ) : null}
        </div>
      </div>

      {selectedProduct && <MarketplaceRfqModal product={selectedProduct} open={!!selectedProduct} onClose={handleCloseModal} />}
    </div>
  );
}
