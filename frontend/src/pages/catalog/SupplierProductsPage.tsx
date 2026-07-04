import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, Search, AlertCircle, RefreshCw } from "lucide-react";
import { catalogService } from "@/services/catalogService";
import { useAuthStore } from "@/stores/authStore";
import { categoryLabel } from "@/constants/categories";
import { cn } from "@/lib/utils";
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

// ─── Main Page ──────────────────────────────────────────────────────────────

export function SupplierProductsPage() {
  const user = useAuthStore((s) => s.user);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const pageSize = 20;

  // Get supplier_id from the current user's profile
  const supplierId = user?.id;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-products", supplierId, page],
    queryFn: () =>
      catalogService.search({
        supplier_id: supplierId,
        q: searchQuery || undefined,
        page,
        page_size: pageSize,
      }),
    enabled: !!supplierId,
  });

  // ── Loading State ──
  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-6">
          <div className="mb-2 h-8 w-48 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-64 animate-pulse rounded bg-gray-100" />
        </div>
        <div className="mb-6 h-12 w-full animate-pulse rounded-lg bg-gray-100" />
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {Array.from({ length: 5 }).map((_, i) => (
                  <th key={i} className="px-4 py-3">
                    <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-t border-gray-100">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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
            onClick={() => refetch()}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white transition-colors hover:bg-red-700"
          >
            <RefreshCw className="h-4 w-4" />
            <span>إعادة المحاولة</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">منتجاتي</h1>
        <p className="mt-1 text-sm text-gray-500">
          جميع المنتجات المستخرجة من مستندات الكتالوج المرفوعة
          {data && ` — إجمالي ${data.total} منتج`}
        </p>
      </div>

      {/* ── Search Bar ── */}
      <div className="mb-6">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="ابحث في منتجاتك..."
            className="w-full rounded-lg border border-gray-300 py-2.5 pr-10 pl-4 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* ── Empty State ── */}
      {(!data || data.items.length === 0) && (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-gray-50 p-12 text-center">
          <Package className="mb-3 h-12 w-12 text-gray-300" />
          <h2 className="mb-2 text-lg font-semibold text-gray-700">لا توجد منتجات بعد</h2>
          <p className="mb-1 text-sm text-gray-500">
            قم برفع كتالوج PDF أو صور المنتجات لاستخراجها وعرضها هنا.
          </p>
          <p className="text-sm text-gray-400">
            استخدم قسم "رفع مستند" في القائمة الجانبية للبدء.
          </p>
        </div>
      )}

      {/* ── Products Table ── */}
      {data && data.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-right">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">المنتج</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">الموديل</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">الفئة</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">السعر (RMB)</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">الكمية الدنيا</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500">المستند المصدر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((product: CatalogProduct) => (
                  <tr key={product.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                          <Package className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 line-clamp-1">
                            {product.product_name ?? "منتج غير معروف"}
                          </p>
                          {product.material && (
                            <p className="text-xs text-gray-400">{product.material}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-500" dir="ltr">
                        {product.model_number ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">
                        {categoryLabel(product.category)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-primary-700">
                        {formatPrice(product.unit_price_rmb)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">
                        {product.moq ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400 line-clamp-1" dir="ltr">
                        {product.document_file_name}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {data.total_pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
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
        </>
      )}
    </div>
  );
}
