import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { intakeService } from "@/services/intakeService";
import { ROUTES } from "@/constants/routes";
import {
  Loader2,
  MapPin,
  Package,
  User,
  Calendar,
  Calculator,
  AlertCircle,
  RefreshCw,
  Clock,
  Check,
  X,
  Zap,
  Globe,
} from "lucide-react";
import type { RFQ, Product, RFQMatch } from "@/types/intake";

type Tab = "exclusive" | "public";

/**
 * Safely render a single extracted_entities value.
 * Handles strings, numbers, arrays, nested objects — avoids [object Object].
 */
function renderEntityValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (Array.isArray(val)) {
    return val.map((item) => renderEntityValue(item)).join(", ");
  }
  if (typeof val === "object") {
    try {
      return Object.entries(val as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${renderEntityValue(v)}`)
        .join(" | ");
    } catch {
      return JSON.stringify(val);
    }
  }
  return String(val);
}

/**
 * Supplier RFQ Inbox — صفحة صندوق وارد طلبات التسعير للمورد
 *
 * Displays exclusive-matched RFQs (with countdown timer) in one tab
 * and the public pool of open RFQs in another tab.
 */
export function SupplierRfqInbox() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("exclusive");

  // ── Tab Toggle ──
  const Tabs = () => (
    <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
      <button
        onClick={() => setActiveTab("exclusive")}
        className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
          activeTab === "exclusive"
            ? "bg-white text-primary-700 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        <Zap className="h-4 w-4" />
        المباريات الحصرية
      </button>
      <button
        onClick={() => setActiveTab("public")}
        className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
          activeTab === "public"
            ? "bg-white text-primary-700 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        <Globe className="h-4 w-4" />
        السوق العام
      </button>
    </div>
  );

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
              تصفح طلبات العروض الحصرية والعامة وقدّم عرض سعر فوري
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Tabs />
            <button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["supplier-inbox"] });
                queryClient.invalidateQueries({ queryKey: ["supplier-matches"] });
                queryClient.invalidateQueries({ queryKey: ["public-rfqs"] });
              }}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
              تحديث
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "exclusive" ? <ExclusiveMatchesTab /> : <PublicPoolTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Exclusive Matches Tab
// ═══════════════════════════════════════════════════════════

function ExclusiveMatchesTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: matchesData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["supplier-matches"],
    queryFn: () => intakeService.listMatched({ limit: 50 }),
    refetchInterval: 30_000, // Refresh every 30s to update countdowns
    staleTime: 10_000,
  });

  const matches = matchesData?.items ?? [];
  const matchRfqIds = matches.map((m) => m.rfq_id);

  // Batch-fetch RFQ details for all matches (1 query instead of N)
  const { data: rfqBatch, isLoading: loadingRfqs } = useQuery({
    queryKey: ["supplier-rfqs-batch", matchRfqIds],
    queryFn: () => intakeService.getBatch(matchRfqIds),
    enabled: matchRfqIds.length > 0,
    staleTime: 30_000,
  });

  // Batch-fetch products for all matches (1 query instead of N)
  const { data: productsBatch, isLoading: loadingProducts } = useQuery({
    queryKey: ["supplier-products-batch", matchRfqIds],
    queryFn: () => intakeService.listProductsBatch(matchRfqIds),
    enabled: matchRfqIds.length > 0,
    staleTime: 30_000,
  });

  const rfqMap = rfqBatch?.items ?? {};
  const productsMap = productsBatch?.items ?? {};
  const loadingDetails = loadingRfqs || loadingProducts;

  // Claim/decline mutation
  const claimMutation = useMutation({
    mutationFn: ({ matchId, action }: { matchId: string; action: "respond" | "decline" }) =>
      intakeService.claimMatch(matchId, { action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-matches"] });
    },
  });

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card animate-pulse p-5">
            <div className="mb-3 h-5 w-3/4 rounded bg-gray-200" />
            <div className="mb-2 h-4 w-full rounded bg-gray-100" />
            <div className="mb-2 h-4 w-2/3 rounded bg-gray-100" />
            <div className="mb-4 h-4 w-1/2 rounded bg-gray-100" />
            <div className="h-9 w-full rounded bg-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  // ── Error ──
  if (isError) {
    return (
      <div className="card p-12 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-4 text-lg font-semibold text-gray-900">
          حدث خطأ أثناء تحميل المباريات
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

  // ── Empty ──
  if (matches.length === 0) {
    return (
      <div className="card p-12 text-center">
        <Zap className="mx-auto h-12 w-12 text-gray-300" />
        <h3 className="mt-4 text-lg font-semibold text-gray-600">
          لا توجد مباريات حصرية حالياً
        </h3>
        <p className="mt-2 text-sm text-gray-400">
          سيتم إشعارك عند وجود طلبات تسعير مطابقة لمتخصصك
        </p>
      </div>
    );
  }

  // ── Data ──
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {matches.map((match) => (
        <MatchCard
          key={match.id}
          match={match}
          rfq={rfqMap[match.rfq_id]}
          products={productsMap[match.rfq_id] ?? []}
          loadingDetails={loadingDetails}
          onQuote={() => navigate(ROUTES.RFQ.BUILD_QUOTE(match.rfq_id))}
          onClaim={(action) => claimMutation.mutate({ matchId: match.id, action })}
          isPending={claimMutation.isPending}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Exclusive Match Card
// ═══════════════════════════════════════════════════════════

interface MatchCardProps {
  match: RFQMatch;
  rfq?: RFQ;
  products: Product[];
  loadingDetails: boolean;
  onQuote: () => void;
  onClaim: (action: "respond" | "decline") => void;
  isPending: boolean;
}

function CountdownTimer({ deadline }: { deadline: string }) {
  const calcRemaining = useCallback(() => {
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0, expired: true };

    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return { hours, minutes, seconds, expired: false };
  }, [deadline]);

  const [remaining, setRemaining] = useState(calcRemaining);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining(calcRemaining());
    }, 1000);
    return () => clearInterval(timer);
  }, [calcRemaining]);

  if (remaining.expired) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        <Clock className="h-3 w-3" />
        انتهت المهلة
      </span>
    );
  }

  const isUrgent = remaining.hours === 0 && remaining.minutes < 30;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        isUrgent
          ? "bg-red-100 text-red-700"
          : "bg-yellow-100 text-yellow-700"
      }`}
    >
      <Clock className="h-3 w-3" />
      {String(remaining.hours).padStart(2, "0")}:
      {String(remaining.minutes).padStart(2, "0")}:
      {String(remaining.seconds).padStart(2, "0")}
    </span>
  );
}

const MATCH_STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  responded: "bg-green-100 text-green-700",
  expired: "bg-red-100 text-red-700",
  declined: "bg-gray-100 text-gray-700",
};

const MATCH_STATUS_LABEL: Record<string, string> = {
  pending: "قيد الانتظار",
  responded: "تم الرد",
  expired: "منتهية",
  declined: "مرفوض",
};

function MatchCard({ match, rfq, products, loadingDetails, onQuote, onClaim, isPending }: MatchCardProps) {
  return (
    <div className="card flex flex-col transition-shadow hover:shadow-md">
      {/* Card Header */}
      <div className="flex items-start justify-between border-b border-gray-100 px-5 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {rfq?.client_name || "عميل"}
            </p>
            <p className="text-xs text-gray-400">
              <Calendar className="ml-1 inline h-3 w-3" />
              {rfq ? new Date(rfq.created_at).toLocaleDateString("ar-SA-u-ca-gregory") : "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Match Score */}
          <span className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
            {Math.round(match.match_score * 100)}%
          </span>
          {/* Status Badge */}
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
              MATCH_STATUS_BADGE[match.status] || "bg-gray-100 text-gray-700"
            }`}
          >
            {MATCH_STATUS_LABEL[match.status] || match.status}
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="flex-1 px-5 py-3">
        {/* Countdown Timer */}
        {match.response_deadline && match.status === "pending" && (
          <div className="mb-3 flex items-center justify-between rounded-md bg-yellow-50 px-3 py-2">
            <span className="text-xs font-medium text-yellow-800">
              المهلة المتبقية للرد
            </span>
            <CountdownTimer deadline={match.response_deadline} />
          </div>
        )}

        {/* Match Reason */}
        {match.match_reason && (
          <p className="mb-2 text-xs text-gray-500">
            {match.match_reason}
          </p>
        )}

        {/* Client Request */}
        {rfq?.client_request_arabic && (
          <p className="mb-3 text-sm leading-relaxed text-gray-700 line-clamp-3">
            {rfq.client_request_arabic}
          </p>
        )}

        {/* Port */}
        {rfq?.destination_port && (
          <div className="mb-3 flex items-center gap-2 text-xs text-gray-500">
            <MapPin className="h-3.5 w-3.5 text-gray-400" />
            <span>{rfq.destination_port}</span>
          </div>
        )}

        {/* Products */}
        {loadingDetails ? (
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
                <span className="max-w-[60%] truncate font-medium text-gray-700">
                  {p.name}
                </span>
                <span className="text-gray-500">
                  {p.quantity.toLocaleString("ar-SA-u-ca-gregory")}{" "}
                  {p.specifications ? `- ${p.specifications}` : "وحدة"}
                </span>
              </div>
            ))}
            {products.length > 3 && (
              <p className="text-xs text-gray-400">
                +{products.length - 3} منتجات أخرى
              </p>
            )}
          </div>
        ) : rfq?.extracted_entities ? (
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
                  {key}: {renderEntityValue(val)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Card Footer — Actions */}
      <div className="border-t border-gray-100 px-5 py-3">
        {match.status === "pending" ? (
          <div className="flex gap-2">
            <button
              onClick={() => onClaim("respond")}
              disabled={isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              قبول والتسعير
            </button>
            <button
              onClick={() => onClaim("decline")}
              disabled={isPending}
              className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              رفض
            </button>
          </div>
        ) : match.status === "responded" ? (
          <button
            onClick={onQuote}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
          >
            <Calculator className="h-4 w-4" />
            عرض السعر المُرسَل
          </button>
        ) : (
          <p className="text-center text-xs text-gray-400">
            {match.status === "expired" ? "انتهت المهلة الحصرية" : "تم رفض الطلب"}
          </p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Public Pool Tab
// ═══════════════════════════════════════════════════════════

function PublicPoolTab() {
  const navigate = useNavigate();

  const {
    data: rfqsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["public-rfqs"],
    queryFn: () => intakeService.listPublic({ limit: 50 }),
    staleTime: 15_000,
  });

  const rfqs = rfqsData?.items ?? [];
  const rfqIds = rfqs.map((r) => r.id);

  // Batch-fetch products for all public RFQs (1 query instead of N)
  const { data: productsBatch, isLoading: loadingProducts } = useQuery({
    queryKey: ["public-products-batch", rfqIds],
    queryFn: () => intakeService.listProductsBatch(rfqIds),
    enabled: rfqIds.length > 0,
    staleTime: 30_000,
  });

  const productsMap = productsBatch?.items ?? {};

  // ── Loading ──
  if (isLoading) {
    return (
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
    );
  }

  // ── Error ──
  if (isError) {
    return (
      <div className="card p-12 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
        <h3 className="mt-4 text-lg font-semibold text-gray-900">
          حدث خطأ أثناء تحميل الطلبات العامة
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

  // ── Empty ──
  if (rfqs.length === 0) {
    return (
      <div className="card p-12 text-center">
        <Globe className="mx-auto h-12 w-12 text-gray-300" />
        <h3 className="mt-4 text-lg font-semibold text-gray-600">
          لا توجد طلبات في السوق العام حالياً
        </h3>
        <p className="mt-2 text-sm text-gray-400">
          ستظهر هنا الطلبات التي انتهت مهلة المطابقة الحصرية لها
        </p>
      </div>
    );
  }

  // ── Data ──
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rfqs.map((rfq) => (
        <PublicRfqCard
          key={rfq.id}
          rfq={rfq}
          products={productsMap[rfq.id] ?? []}
          loadingProducts={loadingProducts}
          onQuote={() => navigate(ROUTES.RFQ.BUILD_QUOTE(rfq.id))}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Public RFQ Card (reuses existing RfqCard pattern)
// ═══════════════════════════════════════════════════════════

interface PublicRfqCardProps {
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

function PublicRfqCard({ rfq, products, loadingProducts, onQuote }: PublicRfqCardProps) {
  return (
    <div className="card flex flex-col transition-shadow hover:shadow-md">
      {/* Card Header */}
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
              {new Date(rfq.created_at).toLocaleDateString("ar-SA-u-ca-gregory")}
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

      {/* Card Body */}
      <div className="flex-1 px-5 py-3">
        {rfq.client_request_arabic && (
          <p className="mb-3 text-sm leading-relaxed text-gray-700 line-clamp-3">
            {rfq.client_request_arabic}
          </p>
        )}

        <div className="mb-3 flex items-center gap-2 text-xs text-gray-500">
          <MapPin className="h-3.5 w-3.5 text-gray-400" />
          <span>{rfq.destination_port || "ميناء غير محدد"}</span>
        </div>

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
                <span className="max-w-[60%] truncate font-medium text-gray-700">
                  {p.name}
                </span>
                <span className="text-gray-500">
                  {p.quantity.toLocaleString("ar-SA-u-ca-gregory")}{" "}
                  {p.specifications ? `- ${p.specifications}` : "وحدة"}
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
                  {key}: {renderEntityValue(val)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Card Footer */}
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
