import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { intakeService } from "@/services/intakeService";
import { ROUTES } from "@/constants/routes";
import {
  Inbox,
  Loader2,
  MapPin,
  Package,
  User,
  Calendar,
  Calculator,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import type { RFQ, Product } from "@/types/intake";

/**
 * Supplier RFQ Inbox — صفحة صندوق وارد طلبات التسعير للمورد
 *
 * Displays open/unassigned RFQs in a responsive card layout.
 * Agents ("suppliers") can browse available RFQs and submit instant quotes.
 */
export function SupplierRfqInbox() {
  const navigate = useNavigate();

  // ── Fetch open RFQs (supplier_id=me scopes to agent's assigned + unassigned open) ──
  const {
    data: rfqsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["supplier-inbox", "open"],
    queryFn: () =>
      intakeService.list({ status: "open", supplier_id: "me", limit: 50 }),
    staleTime: 15_000,
  });

  // ── Fetch products for each RFQ (batch on mount) ──
  const [productsMap, setProductsMap] = useState<Record<string, Product[]>>({});
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    if (!rfqsData?.items.length) return;

    let cancelled = false;
    setLoadingProducts(true);

    const fetchAllProducts = async () => {
      const map: Record<string, Product[]> = {};
      for (const rfq of rfqsData.items) {
        try {
          const products = await intakeService.listProducts(rfq.id);
          if (!cancelled) map[rfq.id] = products;
        } catch {
          // Silently fail — products are supplementary info
          if (!cancelled) map[rfq.id] = [];
        }
      }
      if (!cancelled) {
        setProductsMap(map);
        setLoadingProducts(false);
      }
    };

    fetchAllProducts();

    return () => {
      cancelled = true;
    };
  }, [rfqsData]);

  // ── Loading skeleton ──
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="card p-6">
          <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
          <div className="mt-2 h-4 w-48 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card animate-pulse p-5">
              <div className="mb-3 h-5 w-3/4 rounded bg-gray-200" />
              <div className="mb-2 h-4 w-full rounded bg-gray-100" />
              <div className="mb-2 h-4 w-2/3 rounded bg-gray-100" />
              <div className="mb-4 h-4 w-1/2 rounded bg-gray-100" />
              <div className="h-9 w-full rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (isError) {
    return (
      <div className="card p-12 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-4 text-lg font-semibold text-gray-900">
          حدث خطأ أثناء تحميل الطلبات
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          {error instanceof Error ? error.message : "يرجى المحاولة مرة أخرى"}
        </p>
        <button
          onClick={() => refetch()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          <RefreshCw className="h-4 w-4" />
          إعادة المحاولة
        </button>
      </div>
    );
  }

  // ── Empty state ──
  const rfqs = rfqsData?.items ?? [];
  if (rfqs.length === 0) {
    return (
      <div className="space-y-6">
        <div className="card p-6">
          <h1 className="text-2xl font-bold text-gray-900">
            صندوق وارد طلبات التسعير
          </h1>
          <p className="mt-2 text-gray-600">
            تصفح طلبات العروض المفتوحة وقدّم عرض سعر فوري
          </p>
        </div>
        <div className="card p-12 text-center">
          <Inbox className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-semibold text-gray-600">
            لا توجد طلبات تسعير مفتوحة حالياً
          </h3>
          <p className="mt-2 text-sm text-gray-400">
            سيتم ظهور الطلبات الجديدة هنا عندما يقوم العملاء بإنشائها
          </p>
        </div>
      </div>
    );
  }

  // ── Data: RFQ cards grid ──
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              صندوق وارد طلبات التسعير
            </h1>
            <p className="mt-1 text-gray-600">
              {rfqs.length} طلب تسعير مفتوح — اختر طلباً لتقديم عرض سعر فوري
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            تحديث
          </button>
        </div>
      </div>

      {/* RFQ Cards Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rfqs.map((rfq) => (
          <RfqCard
            key={rfq.id}
            rfq={rfq}
            products={productsMap[rfq.id] ?? []}
            loadingProducts={loadingProducts}
            onQuote={() => navigate(`${ROUTES.PRICING.CALCULATE}?rfq_id=${rfq.id}`)}
          />
        ))}
      </div>
    </div>
  );
}

// ── RFQ Card Sub-component ──

interface RfqCardProps {
  rfq: RFQ;
  products: Product[];
  loadingProducts: boolean;
  onQuote: () => void;
}

const STATUS_BADGE: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  processing: "bg-yellow-100 text-yellow-700",
  translated: "bg-purple-100 text-purple-700",
  quoted: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
};

function RfqCard({ rfq, products, loadingProducts, onQuote }: RfqCardProps) {
  return (
    <div className="card flex flex-col transition-shadow hover:shadow-md">
      {/* Card Header — Client & Status */}
      <div className="flex items-start justify-between border-b border-gray-100 px-5 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <User className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {rfq.client_name || "عميل"}
            </p>
            <p className="text-xs text-gray-400">
              <Calendar className="ml-1 inline h-3 w-3" />
              {new Date(rfq.created_at).toLocaleDateString("ar-SA")}
            </p>
          </div>
        </div>
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
            STATUS_BADGE[rfq.status] || "bg-gray-100 text-gray-700"
          }`}
        >
          {rfq.status === "open" ? "مفتوح" : rfq.status}
        </span>
      </div>

      {/* Card Body — Request & Details */}
      <div className="flex-1 px-5 py-3">
        {/* Client Request */}
        {rfq.client_request_arabic && (
          <p className="mb-3 text-sm leading-relaxed text-gray-700 line-clamp-3">
            {rfq.client_request_arabic}
          </p>
        )}

        {/* Port */}
        <div className="mb-3 flex items-center gap-2 text-xs text-gray-500">
          <MapPin className="h-3.5 w-3.5 text-gray-400" />
          <span>{rfq.destination_port || "ميناء غير محدد"}</span>
        </div>

        {/* Products List */}
        {loadingProducts ? (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            جاري تحميل المنتجات...
          </div>
        ) : products.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-500">
              <Package className="ml-1 inline h-3 w-3" />
              المنتجات ({products.length})
            </p>
            {products.slice(0, 3).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-md bg-gray-50 px-2.5 py-1.5 text-xs"
              >
                <span className="font-medium text-gray-700 truncate max-w-[60%]">
                  {p.name}
                </span>
                <span className="text-gray-500">
                  {p.quantity.toLocaleString("ar-SA")} {p.specifications ? `- ${p.specifications}` : "وحدة"}
                </span>
              </div>
            ))}
            {products.length > 3 && (
              <p className="text-xs text-gray-400">
                +{products.length - 3} منتجات أخرى
              </p>
            )}
          </div>
        ) : rfq.extracted_entities ? (
          // Fallback: show extracted_entities summary
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-500">
              <Package className="ml-1 inline h-3 w-3" />
              المنتجات المستخلصة
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(rfq.extracted_entities).map(([key, val]) => (
                <span
                  key={key}
                  className="inline-block rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-600"
                >
                  {key}: {String(val)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Card Footer — Action */}
      <div className="border-t border-gray-100 px-5 py-3">
        <button
          onClick={onQuote}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          <Calculator className="h-4 w-4" />
          تقديم عرض سعر فوري
        </button>
      </div>
    </div>
  );
}
