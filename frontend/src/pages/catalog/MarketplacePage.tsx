import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, X, Package, AlertCircle, SlidersHorizontal } from "lucide-react";
import toast from "react-hot-toast";
import { catalogService } from "@/services/catalogService";
import { intakeService } from "@/services/intakeService";
import { pricingService } from "@/services/pricingService";
import { useAuthStore } from "@/stores/authStore";
import type { QuickEstimateResponse } from "@/types/pricing";
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
  const [destinationPort, setDestinationPort] = useState("Aqaba");
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens with a different product
  useEffect(() => {
    if (open) {
      setQuantity(product.moq ?? 1);
      setDestinationPort("Aqaba");
      setError(null);
    }
  }, [open, product.moq]);

  // Live cost estimate — re-fetches when quantity or destination changes
  const { data: estimate, isLoading: estimateLoading } = useQuery<QuickEstimateResponse>({
    queryKey: ["estimate", product.id, quantity, destinationPort],
    queryFn: () =>
      pricingService.estimate({
        unit_price_cny: product.unit_price_rmb ?? 0,
        quantity,
        destination_port: destinationPort || "Aqaba",
        // FIX: previously omitted — freight was always computed off a phantom
        // 0.1 CBM minimum regardless of the product's real weight.
        weight_kg: product.weight_kg ?? 0,
      }),
    enabled: open && !!product.unit_price_rmb && quantity > 0,
    retry: false,
    staleTime: 60_000,
  });

  const createRfqMutation = useMutation({
    mutationFn: (data: RFQCreate) => intakeService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfqs"] });
      // A toast (rendered via the <Toaster/> mounted at the layout level —
      // same pattern as useAuth.ts's login/register/logout confirmations)
      // rather than an in-modal success message: onClose() below unmounts
      // the modal in this same tick, so any success state local to it would
      // never actually be visible to the user.
      toast.success("تم إرسال طلب عرض السعر بنجاح");
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
      <div
        className="mx-4 w-full max-w-lg rounded-2xl p-6 shadow-2xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: "var(--text-1)" }}>
            طلب عرض سعر
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 transition-colors"
            style={{ color: "var(--text-3)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Product Details (read-only) */}
        <div className="mb-5 rounded-xl p-4" style={{ background: "var(--surface-2)" }}>
          <h3 className="font-semibold" style={{ color: "var(--text-1)" }}>
            {product.product_name ?? "منتج غير معروف"}
          </h3>
          <div className="mt-2 space-y-1 text-sm" style={{ color: "var(--text-2)" }}>
            {product.model_number && (
              <p>الموديل: <span className="font-medium" style={{ color: "var(--text-1)" }} dir="ltr">{product.model_number}</span></p>
            )}
            <p>
              السعر الأساسي:{" "}
              <span className="font-medium" style={{ color: "var(--text-1)" }}>
                {formatPrice(product.unit_price_rmb)}
              </span>
            </p>
            {product.moq && (
              <p>الحد الأدنى للطلب: <span className="font-medium" style={{ color: "var(--text-1)" }}>{product.moq}</span></p>
            )}
            <p className="text-xs" style={{ color: "var(--text-3)" }}>
              المورد: {product.supplier_name}
              {product.factory_name && ` — ${product.factory_name}`}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quantity + Destination — side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-2)" }}>
                الكمية <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                required
                className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#059669]"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-1)" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-2)" }}>
                ميناء الوصول
              </label>
              <input
                type="text"
                value={destinationPort}
                onChange={(e) => setDestinationPort(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#059669]"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-1)" }}
                placeholder="Aqaba"
              />
            </div>
          </div>

          {/* Cost Estimate Panel */}
          {product.unit_price_rmb && (
            <div className="rounded-xl p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "#059669" }}>
                التكلفة التقديرية
              </p>
              {estimateLoading ? (
                <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-2)" }}>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-[#059669]/30 border-t-[#059669]" />
                  جاري الحساب...
                </div>
              ) : estimate ? (
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between" style={{ color: "var(--text-2)" }}>
                    <span>السعر الأساسي × {estimate.quantity}</span>
                    <span dir="ltr">{(estimate.unit_price_converted * estimate.quantity).toFixed(2)} {estimate.target_currency}</span>
                  </div>
                  {estimate.insurance_cost > 0 && (
                    <div className="flex justify-between" style={{ color: "var(--text-2)" }}>
                      <span>التأمين</span>
                      <span dir="ltr">{estimate.insurance_cost.toFixed(2)} {estimate.target_currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between" style={{ color: "var(--text-2)" }}>
                    <span>الجمارك والرسوم</span>
                    <span dir="ltr">{estimate.customs_duty.toFixed(2)} {estimate.target_currency}</span>
                  </div>
                  {estimate.clearance_fee > 0 && (
                    <div className="flex justify-between" style={{ color: "var(--text-2)" }}>
                      <span>رسوم التخليص</span>
                      <span dir="ltr">{estimate.clearance_fee.toFixed(2)} {estimate.target_currency}</span>
                    </div>
                  )}
                  {estimate.vat > 0 && (
                    <div className="flex justify-between" style={{ color: "var(--text-2)" }}>
                      <span>ضريبة القيمة المضافة</span>
                      <span dir="ltr">{estimate.vat.toFixed(2)} {estimate.target_currency}</span>
                    </div>
                  )}
                  <div
                    className="mt-1 flex justify-between pt-2 font-semibold"
                    style={{ borderTop: "1px solid var(--border)", color: "#059669" }}
                  >
                    <span>المجموع التقديري</span>
                    <span dir="ltr">{estimate.estimated_total.toFixed(2)} {estimate.target_currency}</span>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-3)" }}>{estimate.note}</p>
                  <p className="text-xs" style={{ color: "var(--text-3)" }}>
                    سعر الصرف: 1 CNY = {estimate.exchange_rate.toFixed(4)} {estimate.target_currency}
                  </p>
                </div>
              ) : (
                <p className="text-xs" style={{ color: "var(--text-3)" }}>تعذّر حساب التكلفة التقديرية</p>
              )}
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
              className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
              style={{ background: "#059669" }}
            >
              {isPending ? "جاري الإرسال..." : "إرسال طلب عرض السعر"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text-2)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--hover-bg)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
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
  const isVerified   = true; // demo: all products are verified
  const rating       = (4.5 + Math.random() * 0.4).toFixed(1);
  const stars        = Math.round(parseFloat(rating));
  const certs        = ["CE", "ISO"].slice(0, product.moq && product.moq > 200 ? 1 : 2);

  const priceMin = product.unit_price_rmb ?? 0;
  const priceMax = +(priceMin * 1.3).toFixed(2);

  return (
    <div
      className="rounded-xl overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-xl"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      dir="rtl"
    >
      {/* Image placeholder */}
      <div
        className="h-28 flex flex-col items-center justify-center gap-1 relative"
        style={{
          background: "repeating-linear-gradient(45deg,var(--surface-2),var(--surface-2) 8px,var(--surface-3) 8px,var(--surface-3) 16px)",
        }}
      >
        <span className="text-[9px] font-mono" style={{ color: "var(--text-3)" }}>
          {product.product_name?.toLowerCase().replace(/\s+/g, "-").slice(0, 20)}.jpg
        </span>
        <span className="text-[8px] font-mono" style={{ color: "#2a3848" }}>600 × 400px</span>
        {isVerified && (
          <div
            className="absolute top-2 end-2 text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: "var(--accent-surface)", border: "1px solid var(--accent-border)", color: "#10b981" }}
          >
            مُعتمَد
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="text-[12.5px] font-bold mb-0.5 line-clamp-1" style={{ color: "var(--text-1)" }}>
          {product.product_name ?? "منتج غير معروف"}
        </div>
        <div className="text-[10px] mb-2" style={{ color: "var(--text-2)" }}>
          🇨🇳 {product.factory_name ?? product.supplier_name}
          {product.location_in_china && ` · ${product.location_in_china}`}
        </div>

        <div className="flex justify-between items-center mb-1">
          <div>
            <span className="text-[14px] font-black font-mono" style={{ color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }} dir="ltr">
              ${priceMin.toFixed(1)}
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-2)" }}> – ${priceMax}</span>
          </div>
          <span className="text-[10px]" style={{ color: "var(--text-2)" }}>MOQ: {product.moq ?? 100}</span>
        </div>

        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className="text-[11px]" style={{ color: i < stars ? "#f59e0b" : "#f59e0b", opacity: i < stars ? 1 : 0.2 }}>★</span>
            ))}
            <span className="text-[9px] ms-1" style={{ color: "var(--text-2)" }}>{rating}</span>
          </div>
          <div className="flex gap-1">
            {certs.map((c) => (
              <div key={c} className="px-1.5 py-0.5 rounded text-[8px]" style={{ background: "var(--surface-3)", color: "var(--text-4)" }}>{c}</div>
            ))}
          </div>
        </div>

        <button
          onClick={() => onRequestQuote(product)}
          className="w-full py-2 text-[11px] font-bold text-white rounded-md transition-all hover:brightness-110"
          style={{ background: "#059669" }}
        >
          طلب عرض سعر
        </button>
      </div>
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
    data.items.forEach((p) => { if (p.supplier_id && p.supplier_name) map.set(p.supplier_id, p.supplier_name); });
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
    <div className="space-y-4" dir="rtl">
      {/* Page Header */}
      <div
        className="flex flex-col gap-3 px-4 py-3.5 rounded-lg sm:flex-row sm:items-center sm:justify-between sm:px-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div>
          <h1 className="text-[18px] font-bold" style={{ color: "var(--text-1)" }}>سوق الموردين</h1>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-2)" }}>
            240+ مورّد صيني مُعتمَد في التجارة العابرة للحدود
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div
            className="flex flex-1 items-center gap-2 rounded-md px-3 py-2 sm:w-56 sm:flex-none"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--text-2)" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث..."
              className="flex-1 bg-transparent text-[12px] outline-none"
              style={{ color: "var(--text-1)" }}
              dir="rtl"
            />
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex shrink-0 items-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-medium transition-colors"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-dim)" }}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            فلاتر
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px]" style={{ color: "var(--text-2)" }}>تصفية:</span>
        {["معدات صناعية", "إلكترونيات", "شهادة CE", "MOQ < 100"].map((chip, i) => (
          <button
            key={chip}
            className="px-3 py-1 rounded-full text-[11px] font-medium transition-all"
            style={
              i === 0
                ? { background: "var(--accent-surface)", border: "1px solid var(--accent-border)", color: "#10b981" }
                : { background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-4)" }
            }
          >
            {chip}
          </button>
        ))}
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-xl overflow-hidden"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="h-28" style={{ background: "var(--surface-2)" }} />
                  <div className="p-3 space-y-2">
                    <div className="h-4 rounded" style={{ background: "var(--surface-3)" }} />
                    <div className="h-3 w-2/3 rounded" style={{ background: "var(--surface-3)" }} />
                    <div className="h-8 rounded mt-4" style={{ background: "var(--accent-surface)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {isError && (
            <div
              className="flex flex-col items-center gap-3 p-12 text-center rounded-xl"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <AlertCircle className="h-10 w-10" style={{ color: "#dc2626" }} />
              <p className="text-sm" style={{ color: "#dc2626" }}>
                {(error as Error)?.message ?? "فشل تحميل المنتجات. يرجى المحاولة لاحقاً."}
              </p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !isError && data && data.items.length === 0 && (
            <div
              className="flex flex-col items-center gap-3 p-12 text-center rounded-xl"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <Package className="h-12 w-12" style={{ color: "var(--text-3)" }} />
              <p className="text-base font-medium" style={{ color: "var(--text-2)" }}>
                {debouncedQuery || filters.category || filters.supplierId
                  ? "لا توجد منتجات تطابق بحثك"
                  : "لا توجد منتجات متاحة حالياً"}
              </p>
            </div>
          )}

          {/* Product Grid */}
          {!isLoading && !isError && data && data.items.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                          className="min-w-[2rem] rounded-md px-3 py-1.5 text-sm font-medium transition-all"
                          style={p === page
                            ? { background: "#059669", color: "#fff" }
                            : { color: "var(--text-4)" }}
                        >
                          {p}
                        </button>
                      )
                    )}

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-md px-3 py-1.5 text-sm transition-colors disabled:opacity-40"
                    style={{ border: "1px solid var(--border)", color: "var(--text-4)" }}
                  >
                    التالي
                  </button>
                </div>
              )}

              <p className="text-center text-[11px]" style={{ color: "var(--text-3)" }}>
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
