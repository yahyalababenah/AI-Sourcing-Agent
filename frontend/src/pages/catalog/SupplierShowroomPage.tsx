import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Package,
  MapPin,
  ShoppingCart,
  ArrowRight,
  Building2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { catalogService } from "@/services/catalogService";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import type { CatalogProduct } from "@/types/catalog";

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

// ─── Product Card ───────────────────────────────────────────────────────────

interface ProductCardProps {
  product: CatalogProduct;
  onRequestQuote: (product: CatalogProduct) => void;
}

function ProductCard({ product, onRequestQuote }: ProductCardProps) {
  return (
    <div className="card group flex flex-col rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-primary-200 hover:shadow-md">
      {/* Product Icon */}
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
          <span className="mr-2 text-xs text-gray-400">MOQ: {product.moq}</span>
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

export function SupplierShowroomPage() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Fetch all products for this supplier
  const { data, isLoading, isError } = useQuery({
    queryKey: ["supplier-products", supplierId, page],
    queryFn: () =>
      catalogService.search({
        supplier_id: supplierId,
        page,
        page_size: pageSize,
      }),
    enabled: !!supplierId,
  });

  // Derive supplier info from the first product
  const supplierInfo = data?.items?.[0]
    ? {
        name: data.items[0].supplier_name,
        factoryName: data.items[0].factory_name,
        location: data.items[0].location_in_china,
      }
    : null;

  // Reset page when supplierId changes
  useEffect(() => {
    setPage(1);
  }, [supplierId]);

  // ── Loading State ──
  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        {/* Supplier header skeleton */}
        <div className="mb-8 animate-pulse rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-3 h-8 w-64 rounded bg-gray-200" />
          <div className="mb-2 h-4 w-48 rounded bg-gray-100" />
          <div className="h-4 w-36 rounded bg-gray-100" />
        </div>

        {/* Product grid skeleton */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-3 h-12 w-12 rounded-lg bg-gray-200" />
              <div className="mb-2 h-5 w-full rounded bg-gray-200" />
              <div className="mb-4 h-4 w-20 rounded bg-gray-100" />
              <div className="mb-3 h-7 w-28 rounded bg-gray-200" />
              <div className="h-10 w-full rounded-lg bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (isError) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <div className="flex flex-col items-center justify-center rounded-2xl bg-red-50 p-12 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-red-500" />
          <h2 className="mb-2 text-lg font-semibold text-red-700">فشل في تحميل المنتجات</h2>
          <p className="mb-4 text-sm text-red-500">تعذر الاتصال بالخادم. يرجى المحاولة مرة أخرى.</p>
          <button
            onClick={() => navigate(ROUTES.CATALOG.MARKETPLACE)}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700"
          >
            <ArrowRight className="h-4 w-4" />
            <span>العودة إلى السوق</span>
          </button>
        </div>
      </div>
    );
  }

  // ── Empty State ──
  if (!data || data.items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <div className="flex flex-col items-center justify-center rounded-2xl bg-gray-50 p-12 text-center">
          <Package className="mb-3 h-10 w-10 text-gray-400" />
          <h2 className="mb-2 text-lg font-semibold text-gray-700">لا توجد منتجات</h2>
          <p className="mb-4 text-sm text-gray-500">لم يقم هذا المورد بإضافة منتجات بعد.</p>
          <button
            onClick={() => navigate(ROUTES.CATALOG.MARKETPLACE)}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm text-white transition-colors hover:bg-primary-700"
          >
            <ArrowRight className="h-4 w-4" />
            <span>استعراض السوق</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* ── Supplier Header ── */}
      <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <Building2 className="h-8 w-8" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {supplierInfo?.factoryName ?? supplierInfo?.name ?? "المورد"}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                <CheckCircle className="h-3.5 w-3.5" />
                مورد موثوق
              </span>
            </div>
            <p className="mt-1 text-base text-gray-600">
              {supplierInfo?.name}
            </p>
            {supplierInfo?.location && (
              <div className="mt-2 flex items-center gap-1.5 text-sm text-gray-500">
                <MapPin className="h-4 w-4" />
                <span>{supplierInfo.location}</span>
              </div>
            )}
            <p className="mt-1 text-sm text-gray-400">
              {data.total} منتج متاح
            </p>
          </div>
        </div>
      </div>

      {/* ── Product Grid ── */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.items.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onRequestQuote={() => {
              navigate(ROUTES.CATALOG.MARKETPLACE);
            }}
          />
        ))}
      </div>

      {/* ── Pagination ── */}
      {data.total_pages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className={cn(
              "rounded-lg border px-4 py-2 text-sm transition-colors",
              page <= 1
                ? "cursor-not-allowed border-gray-200 text-gray-300"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            )}
          >
            السابق
          </button>
          <span className="px-4 text-sm text-gray-500">
            الصفحة {page} من {data.total_pages}
          </span>
          <button
            disabled={page >= data.total_pages}
            onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
            className={cn(
              "rounded-lg border px-4 py-2 text-sm transition-colors",
              page >= data.total_pages
                ? "cursor-not-allowed border-gray-200 text-gray-300"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            )}
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}
