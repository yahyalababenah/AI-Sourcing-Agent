import { Search, X, Package, AlertCircle, SlidersHorizontal } from "lucide-react";
import { CatalogFilters } from "./CatalogFilters";
import { MarketplaceProductCard } from "./MarketplaceProductCard";
import { MarketplaceRfqModal } from "./MarketplaceRfqModal";
import { useMarketplaceData } from "./useMarketplaceData";
import { categoryLabel } from "@/constants/categories";

// Same shared hook/data as MarketplacePageDesktop, stacked into a single
// column: search + "فلاتر" button opening the CatalogFilters overlay, real
// active-filter chips, then a 1/2-column product grid. TopBar/BottomNav/
// Drawer come from the role's own layout.
export function MarketplacePageMobile() {
  const {
    searchQuery,
    setSearchQuery,
    page,
    setPage,
    totalPages,
    filters,
    setFilters,
    clearFilter,
    handleResetFilters,
    hasActiveFilters,
    filtersOpen,
    setFiltersOpen,
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
      <div className="space-y-2">
        <div>
          <h1 className="text-lg font-bold text-slate-900">سوق الموردين</h1>
          <p className="text-[11px] text-slate-500">240+ مورّد صيني في التجارة العابرة للحدود</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث..."
              className="flex-1 bg-transparent text-[12px] text-slate-900 outline-none"
            />
          </div>
          <button
            onClick={() => setFiltersOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-medium text-slate-600 transition-colors duration-150 active:scale-[0.98]"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            فلاتر
          </button>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {filters.category && (
            <button
              onClick={() => clearFilter("category")}
              className="flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-medium text-brand-600"
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
              className="flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-medium text-brand-600"
            >
              ¥{filters.minPrice || "0"} – {filters.maxPrice || "∞"}
              <X className="h-3 w-3" />
            </button>
          )}
          {filters.supplierId && (
            <button
              onClick={() => clearFilter("supplierId")}
              className="flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-medium text-brand-600"
            >
              {uniqueSuppliers.find((s) => s.id === filters.supplierId)?.name ?? filters.supplierId}
              <X className="h-3 w-3" />
            </button>
          )}
          <button onClick={handleResetFilters} className="text-[11px] text-slate-400 underline">
            مسح الكل
          </button>
        </div>
      )}

      <CatalogFilters
        variant="overlay"
        suppliers={uniqueSuppliers}
        categories={categories}
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
        isOpen={filtersOpen}
        onToggle={() => setFiltersOpen((o) => !o)}
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card animate-pulse overflow-hidden">
              <div className="h-24 bg-slate-100" />
              <div className="space-y-2 p-3">
                <div className="h-4 rounded bg-slate-100" />
                <div className="mt-3 h-8 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
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
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <Package className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">
            {debouncedQuery || filters.category || filters.supplierId
              ? "لا توجد منتجات تطابق بحثك"
              : "لا توجد منتجات متاحة حالياً"}
          </p>
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            {data.items.map((product) => (
              <MarketplaceProductCard key={product.id} product={product} onRequestQuote={handleRequestQuote} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition-colors duration-150 disabled:opacity-40"
              >
                السابق
              </button>
              <span className="px-2 text-sm text-slate-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition-colors duration-150 disabled:opacity-40"
              >
                التالي
              </button>
            </div>
          )}
        </>
      ) : null}

      {selectedProduct && <MarketplaceRfqModal product={selectedProduct} open={!!selectedProduct} onClose={handleCloseModal} />}
    </div>
  );
}
