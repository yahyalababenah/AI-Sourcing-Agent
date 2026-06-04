import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, ShoppingCart, X, Package, Factory, MapPin, AlertCircle, CheckCircle, SlidersHorizontal, ExternalLink } from "lucide-react";
import { catalogService } from "@/services/catalogService";
import { intakeService } from "@/services/intakeService";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import type { CatalogProduct, CatalogListResponse } from "@/types/catalog";
import type { RFQCreate } from "@/types/intake";
import { CatalogFilters, type FilterState } from "./CatalogFilters";

// ─── helpers ────────────────────────────────────────────────────────────────

const formatPrice = (price: number | null): string => {
  if (price === null || price === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
};

// ─── RFQ Modal ──────────────────────────────────────────────────────────────

interface RfqModalProps {
  product: CatalogProduct;
  open: boolean;
  onClose: () => void;
}

function RfqModal({ product, open, onClose }: RfqModalProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [quantity, setQuantity] = useState<number>(product.moq ?? 1);
  const [destinationPort, setDestinationPort] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens with a different product
  useEffect(() => {
    if (open) {
      setQuantity(product.moq ?? 1);
      setDestinationPort("");
      setError(null);
    }
  }, [open, product.moq]);

  const createRfqMutation = useMutation({
    mutationFn: (data: RFQCreate) => intakeService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfqs"] });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!quantity || quantity < 1) {
      setError("يرجى إدخال كمية صالحة");
      return;
    }

    const payload: RFQCreate = {
      client_name: user?.full_name ?? "",
      client_phone: user?.phone ?? "",
      client_request_arabic: [
        `طلب شراء: ${product.product_name ?? "منتج"}`,
        product.model_number ? `الموديل: ${product.model_number}` : null,
        `الكمية: ${quantity}`,
        product.moq ? `الحد الأدنى للطلب: ${product.moq}` : null,
        `المورد: ${product.supplier_name}`,
        product.factory_name ? `المصنع: ${product.factory_name}` : null,
        destinationPort ? `ميناء الوصول: ${destinationPort}` : null,
      ]
        .filter(Boolean)
        .join(" — "),
      extracted_entities: {
        product_name: product.product_name ?? "",
        model_number: product.model_number ?? "",
        quantity: String(quantity),
        unit_price_rmb: String(product.unit_price_rmb ?? ""),
        supplier_name: product.supplier_name,
        supplier_id: product.supplier_id,
        document_id: product.document_id,
      },
      destination_port: destinationPort || undefined,
      target_currency: "USD",
    };

    createRfqMutation.mutate(payload);
  };

  if (!open) return null;

  const isPending = createRfqMutation.isPending;
  const isSuccess = createRfqMutation.isSuccess;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            طلب عرض سعر
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Product Details (read-only) */}
        <div className="mb-5 rounded-xl bg-gray-50 p-4">
          <h3 className="font-semibold text-gray-900">
            {product.product_name ?? "منتج غير معروف"}
          </h3>
          <div className="mt-2 space-y-1 text-sm text-gray-600">
            {product.model_number && (
              <p>الموديل: <span className="font-medium text-gray-800" dir="ltr">{product.model_number}</span></p>
            )}
            <p>
              السعر الأساسي:{" "}
              <span className="font-medium text-gray-800">
                {formatPrice(product.unit_price_rmb)}
              </span>
            </p>
            {product.moq && (
              <p>الحد الأدنى للطلب: <span className="font-medium text-gray-800">{product.moq}</span></p>
            )}
            <p className="text-xs text-gray-400">
              المورد: {product.supplier_name}
              {product.factory_name && ` — ${product.factory_name}`}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quantity */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              الكمية المطلوبة <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="1"
            />
          </div>

          {/* Destination Port */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              ميناء الوصول
            </label>
            <input
              type="text"
              value={destinationPort}
              onChange={(e) => setDestinationPort(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="ميناء العقبة، الأردن"
            />
          </div>

          {/* Success State */}
          {isSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle className="h-4 w-4 shrink-0" />
              تم إرسال طلب عرض السعر بنجاح
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending || isSuccess}
              className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              {isPending ? "جاري الإرسال..." : "إرسال طلب عرض السعر"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Product Card ───────────────────────────────────────────────────────────

interface ProductCardProps {
  product: CatalogProduct;
  onRequestQuote: (product: CatalogProduct) => void;
}

function ProductCard({ product, onRequestQuote }: ProductCardProps) {
  const showroomPath = ROUTES.CATALOG.SUPPLIER_SHOWROOM(product.supplier_id);
  return (
    <div className="card group flex flex-col rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-primary-200 hover:shadow-md">
      {/* Product Icon / Image placeholder */}
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
        <Package className="h-6 w-6" />
      </div>

      {/* Product Name */}
      <h3 className="mb-1 text-base font-semibold text-gray-900 line-clamp-2">
        {product.product_name ?? "منتج غير معروف"}
      </h3>

      {/* Model */}
      {product.model_number && (
        <p className="mb-2 text-xs font-mono text-gray-400" dir="ltr">
          {product.model_number}
        </p>
      )}

      {/* Price */}
      <div className="mb-3">
        <span className="text-lg font-bold text-primary-700">
          {formatPrice(product.unit_price_rmb)}
        </span>
        {product.moq && (
          <span className="mr-2 text-xs text-gray-400">
            MOQ: {product.moq}
          </span>
        )}
      </div>

      {/* Supplier Info */}
      <div className="mb-4 space-y-1 text-xs text-gray-500">
        <Link
          to={showroomPath}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 text-gray-500 transition-colors hover:text-primary-600"
        >
          <Factory className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate underline decoration-dotted underline-offset-2">
            {product.factory_name ?? product.supplier_name}
          </span>
          <ExternalLink className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover/link:opacity-100" />
        </Link>
        {product.location_in_china && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{product.location_in_china}</span>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* CTA */}
      <button
        onClick={() => onRequestQuote(product)}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
      >
        <ShoppingCart className="h-4 w-4" />
        <span>طلب تسعير كمية</span>
      </button>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    category: "",
    minPrice: "",
    maxPrice: "",
    supplierId: "",
  });
  const pageSize = 12;

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1); // reset to first page on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filters]);

  // Fetch catalog products
  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery<CatalogListResponse>({
    queryKey: [
      "catalog", "products",
      debouncedQuery,
      filters.category, filters.minPrice, filters.maxPrice, filters.supplierId,
      page, pageSize,
    ],
    queryFn: () =>
      catalogService.search({
        q: debouncedQuery || undefined,
        category: filters.category || undefined,
        min_price: filters.minPrice ? Number(filters.minPrice) : undefined,
        max_price: filters.maxPrice ? Number(filters.maxPrice) : undefined,
        supplier_id: filters.supplierId || undefined,
        page,
        page_size: pageSize,
      }),
  });

  // Derive unique suppliers and categories from current data
  const uniqueSuppliers = useMemo(() => {
    if (!data?.items) return [];
    const map = new Map<string, string>();
    data.items.forEach((p) => map.set(p.supplier_id, p.supplier_name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  const uniqueCategories = useMemo(() => {
    if (!data?.items) return [];
    const cats = new Set<string>();
    data.items.forEach((p) => {
      if (p.category) cats.add(p.category);
      if (p.material) cats.add(p.material);
    });
    return Array.from(cats).sort();
  }, [data]);

  const handleRequestQuote = useCallback((product: CatalogProduct) => {
    setSelectedProduct(product);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedProduct(null);
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({ category: "", minPrice: "", maxPrice: "", supplierId: "" });
  }, []);

  const totalPages = data?.total_pages ?? 1;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            السوق العالمي
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            تصفح المنتجات المتاحة من جميع الموردين واحصل على عروض أسعار فورية
          </p>
        </div>

        {/* Mobile filter toggle */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" />
          فلاتر
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث عن منتج... (مثل: مواتير، شاشات، قطع غيار)"
          className="w-full rounded-xl border border-gray-200 bg-white py-3.5 pr-12 pl-4 text-sm shadow-sm transition-all focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
      </div>

      {/* Main Content: Sidebar + Product Grid */}
      <div className="flex gap-6">
        {/* Filters Sidebar */}
        <CatalogFilters
          suppliers={uniqueSuppliers}
          categories={uniqueCategories}
          filters={filters}
          onChange={setFilters}
          onReset={handleResetFilters}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((prev) => !prev)}
        />

        {/* Product Area */}
        <div className="min-w-0 flex-1 space-y-6">
          {/* Loading State */}
          {isLoading && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-xl border border-gray-200 bg-white p-5"
                >
                  <div className="mb-3 h-12 w-12 rounded-lg bg-gray-100" />
                  <div className="mb-2 h-5 w-3/4 rounded bg-gray-100" />
                  <div className="mb-3 h-4 w-1/2 rounded bg-gray-100" />
                  <div className="mb-3 h-6 w-1/3 rounded bg-gray-100" />
                  <div className="mb-4 space-y-1">
                    <div className="h-3 w-full rounded bg-gray-100" />
                    <div className="h-3 w-2/3 rounded bg-gray-100" />
                  </div>
                  <div className="h-10 w-full rounded-lg bg-gray-100" />
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {isError && (
            <div className="card flex flex-col items-center gap-3 p-12 text-center">
              <AlertCircle className="h-10 w-10 text-red-400" />
              <p className="text-sm text-red-600">
                {(error as Error)?.message ?? "فشل تحميل المنتجات. يرجى المحاولة لاحقاً."}
              </p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !isError && data && data.items.length === 0 && (
            <div className="card flex flex-col items-center gap-3 p-12 text-center">
              <Package className="h-12 w-12 text-gray-300" />
              <p className="text-base font-medium text-gray-500">
                {debouncedQuery || filters.category || filters.supplierId
                  ? "لا توجد منتجات تطابق بحثك"
                  : "لا توجد منتجات متاحة حالياً"}
              </p>
              <p className="text-sm text-gray-400">
                {debouncedQuery || filters.category || filters.supplierId
                  ? "حاول استخدام كلمات بحث مختلفة أو إعادة تعيين الفلاتر"
                  : "سيتم إضافة المنتجات عند توفرها من الموردين"}
              </p>
            </div>
          )}

          {/* Product Grid */}
          {!isLoading && !isError && data && data.items.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {data.items.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onRequestQuote={handleRequestQuote}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
                  >
                    السابق
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      return (
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - page) <= 1
                      );
                    })
                    .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                        acc.push("ellipsis");
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      p === "ellipsis" ? (
                        <span key={`e-${idx}`} className="px-1 text-gray-400">
                          ...
                        </span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={cn(
                            "min-w-[2rem] rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                            p === page
                              ? "bg-primary-600 text-white"
                              : "text-gray-600 hover:bg-gray-50"
                          )}
                        >
                          {p}
                        </button>
                      )
                    )}

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
                  >
                    التالي
                  </button>
                </div>
              )}

              {/* Results Count */}
              <p className="text-center text-xs text-gray-400">
                إجمالي {data.total} منتج — الصفحة {page} من {totalPages}
              </p>
            </>
          )}
        </div>
      </div>

      {/* RFQ Modal */}
      {selectedProduct && (
        <RfqModal
          product={selectedProduct}
          open={!!selectedProduct}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
