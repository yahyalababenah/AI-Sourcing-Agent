import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { catalogService } from "@/services/catalogService";
import { PRODUCT_CATEGORIES } from "@/constants/categories";
import type { CatalogProduct, CatalogListResponse } from "@/types/catalog";
import type { FilterState } from "./CatalogFilters";

const PAGE_SIZE = 12;
const EMPTY_FILTERS: FilterState = { category: "", minPrice: "", maxPrice: "", supplierId: "" };

/** Shared data/logic behind the marketplace (T8.5) — search, filters,
 * pagination, and RFQ-modal selection — consumed by both
 * MarketplacePageDesktop and MarketplacePageMobile so neither duplicates
 * the fetch/filter logic (same convention as usePricingCalculator/
 * useSupplierRfqInboxData in earlier phases). */
export function useMarketplaceData() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filters]);

  const { data, isLoading, isError, error } = useQuery<CatalogListResponse>({
    queryKey: [
      "catalog", "products",
      debouncedQuery,
      filters.category, filters.minPrice, filters.maxPrice, filters.supplierId,
      page, PAGE_SIZE,
    ],
    queryFn: () =>
      catalogService.search({
        q: debouncedQuery || undefined,
        category: filters.category || undefined,
        min_price: filters.minPrice ? Number(filters.minPrice) : undefined,
        max_price: filters.maxPrice ? Number(filters.maxPrice) : undefined,
        supplier_id: filters.supplierId || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
  });

  const uniqueSuppliers = useMemo(() => {
    if (!data?.items) return [];
    const map = new Map<string, string>();
    data.items.forEach((p) => {
      if (p.supplier_id && p.supplier_name) map.set(p.supplier_id, p.supplier_name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  const handleRequestQuote = useCallback((product: CatalogProduct) => setSelectedProduct(product), []);
  const handleCloseModal = useCallback(() => setSelectedProduct(null), []);
  const handleResetFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);
  const clearFilter = useCallback((key: keyof FilterState) => {
    setFilters((f) => ({ ...f, [key]: "" }));
  }, []);

  const hasActiveFilters =
    filters.category !== "" || filters.minPrice !== "" || filters.maxPrice !== "" || filters.supplierId !== "";

  const totalPages = data?.total_pages ?? 1;

  return {
    searchQuery,
    setSearchQuery,
    page,
    setPage,
    totalPages,
    total: data?.total ?? 0,
    filters,
    setFilters,
    clearFilter,
    handleResetFilters,
    hasActiveFilters,
    filtersOpen,
    setFiltersOpen,
    uniqueSuppliers,
    categories: PRODUCT_CATEGORIES,
    data,
    isLoading,
    isError,
    error,
    debouncedQuery,
    selectedProduct,
    handleRequestQuote,
    handleCloseModal,
  };
}
