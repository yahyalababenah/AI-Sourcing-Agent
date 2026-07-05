import { useCallback, useEffect, useState } from "react";
import { Loader2, MapPin, Package, User, Clock, Check, X, Zap, Calculator } from "lucide-react";
import type { RFQ, Product, RFQMatch } from "@/types/intake";

/** Safely render a single extracted_entities value. Handles strings,
 * numbers, arrays, nested objects — avoids [object Object]. */
export function renderEntityValue(val: unknown): string {
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

/** "عدّاد الزمن منذ الوصول" (T8.2) — how long an RFQ has been sitting
 * unanswered, framed as time pressure (matches the "الضغط الزمني" wording
 * used on the agent dashboard's "تنتظر ردّك" strip, T3.1/T3.2): the longer
 * it's been open, the more urgent the badge color. `now` is passed in from
 * useSupplierRfqInboxData's shared minute-tick so every card on the page
 * updates together without a per-card interval. */
export function ElapsedTimeBadge({ createdAt, now }: { createdAt: string; now: number }) {
  const diffMs = now - new Date(createdAt).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let label: string;
  if (diffMin < 1) label = "الآن";
  else if (diffMin < 60) label = `منذ ${diffMin} د`;
  else if (diffHrs < 24) label = `منذ ${diffHrs} س`;
  else if (diffDays < 30) label = `منذ ${diffDays} ي`;
  else label = new Date(createdAt).toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "short" });

  // Time pressure: fresh (<1h) is neutral, same-day is a mild amber nudge,
  // anything left over a day is flagged red — every hour of delay reduces
  // the odds of winning the deal.
  const urgency = diffHrs >= 24 ? "bg-red-100 text-red-700" : diffHrs >= 1 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${urgency}`}>
      <Clock className="h-3 w-3" />
      {label}
    </span>
  );
}

export function CountdownTimer({ deadline }: { deadline: string }) {
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
        isUrgent ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      <Clock className="h-3 w-3" />
      {String(remaining.hours).padStart(2, "0")}:
      {String(remaining.minutes).padStart(2, "0")}:
      {String(remaining.seconds).padStart(2, "0")}
    </span>
  );
}

export const MATCH_STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  responded: "bg-emerald-100 text-emerald-700",
  expired: "bg-red-100 text-red-700",
  declined: "bg-slate-100 text-slate-500",
};

export const MATCH_STATUS_LABEL: Record<string, string> = {
  pending: "قيد الانتظار",
  responded: "تم الرد",
  expired: "منتهية",
  declined: "مرفوض",
};

export const RFQ_STATUS_BADGE: Record<string, string> = {
  open: "bg-sky-100 text-sky-700",
  processing: "bg-amber-100 text-amber-700",
  translated: "bg-supplier-100 text-supplier-600",
  quoted: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-100 text-slate-500",
  cancelled: "bg-red-100 text-red-700",
};

function ProductsList({ products, loading, extractedEntities }: {
  products: Product[];
  loading: boolean;
  extractedEntities?: Record<string, unknown>;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        جاري تحميل المنتجات...
      </div>
    );
  }

  if (products.length > 0) {
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-slate-500">
          <Package className="ms-1 inline h-3 w-3" />
          المنتجات ({products.length})
        </p>
        {products.slice(0, 3).map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5 text-xs">
            <span className="max-w-[60%] truncate font-medium text-slate-700">{p.name}</span>
            <span className="text-slate-500">
              {p.quantity.toLocaleString("ar-SA-u-ca-gregory")} {p.specifications ? `- ${p.specifications}` : "وحدة"}
            </span>
          </div>
        ))}
        {products.length > 3 && <p className="text-xs text-slate-400">+{products.length - 3} منتجات أخرى</p>}
      </div>
    );
  }

  if (extractedEntities) {
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-slate-500">
          <Package className="ms-1 inline h-3 w-3" />
          المنتجات المستخلصة
        </p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(extractedEntities).map(([key, val]) => (
            <span key={key} className="inline-block rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">
              {key}: {renderEntityValue(val)}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

interface MatchCardProps {
  match: RFQMatch;
  rfq?: RFQ;
  products: Product[];
  loadingDetails: boolean;
  now: number;
  onQuote: () => void;
  onClaim: (action: "respond" | "decline") => void;
  isPending: boolean;
}

/** Exclusive-match card — shared between SupplierRfqInboxDesktop (grid) and
 * SupplierRfqInboxMobile (stacked single column); only the container layout
 * differs between the two page files. */
export function MatchCard({ match, rfq, products, loadingDetails, now, onQuote, onClaim, isPending }: MatchCardProps) {
  return (
    <div className="card flex flex-col transition-shadow duration-150 hover:shadow-md">
      <div className="flex items-start justify-between border-b border-slate-100 px-5 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-supplier-100 text-supplier-600">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">{rfq?.client_name || "عميل"}</p>
            {rfq && <ElapsedTimeBadge createdAt={rfq.created_at} now={now} />}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-supplier-100 px-2 py-0.5 text-xs font-medium text-supplier-600">
            {Math.round(match.match_score * 100)}%
          </span>
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
              MATCH_STATUS_BADGE[match.status] || "bg-slate-100 text-slate-500"
            }`}
          >
            {MATCH_STATUS_LABEL[match.status] || match.status}
          </span>
        </div>
      </div>

      <div className="flex-1 px-5 py-3">
        {match.response_deadline && match.status === "pending" && (
          <div className="mb-3 flex items-center justify-between rounded-md bg-amber-50 px-3 py-2">
            <span className="text-xs font-medium text-amber-800">المهلة المتبقية للرد</span>
            <CountdownTimer deadline={match.response_deadline} />
          </div>
        )}

        {match.match_reason && <p className="mb-2 text-xs text-slate-500">{match.match_reason}</p>}

        {rfq?.client_request_arabic && (
          <p className="mb-3 line-clamp-3 text-sm leading-relaxed text-slate-700">{rfq.client_request_arabic}</p>
        )}

        {rfq?.destination_port && (
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            <span>{rfq.destination_port}</span>
          </div>
        )}

        <ProductsList products={products} loading={loadingDetails} extractedEntities={rfq?.extracted_entities} />
      </div>

      <div className="border-t border-slate-100 px-5 py-3">
        {match.status === "pending" ? (
          <div className="flex gap-2">
            <button
              onClick={() => onClaim("respond")}
              disabled={isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              قبول والتسعير
            </button>
            <button
              onClick={() => onClaim("decline")}
              disabled={isPending}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              رفض
            </button>
          </div>
        ) : match.status === "responded" ? (
          <button
            onClick={onQuote}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-supplier-500 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-supplier-600 active:scale-[0.98]"
          >
            <Calculator className="h-4 w-4" />
            عرض السعر المُرسَل
          </button>
        ) : (
          <p className="text-center text-xs text-slate-400">
            {match.status === "expired" ? "انتهت المهلة الحصرية" : "تم رفض الطلب"}
          </p>
        )}
      </div>
    </div>
  );
}

interface PublicRfqCardProps {
  rfq: RFQ;
  products: Product[];
  loadingProducts: boolean;
  now: number;
  onQuote: () => void;
}

/** Public-pool RFQ card — same shared-component convention as MatchCard. */
export function PublicRfqCard({ rfq, products, loadingProducts, now, onQuote }: PublicRfqCardProps) {
  return (
    <div className="card flex flex-col transition-shadow duration-150 hover:shadow-md">
      <div className="flex items-start justify-between border-b border-slate-100 px-5 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-supplier-100 text-supplier-600">
            <User className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">{rfq.client_name || "عميل"}</p>
            <ElapsedTimeBadge createdAt={rfq.created_at} now={now} />
          </div>
        </div>
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
            RFQ_STATUS_BADGE[rfq.status] || "bg-slate-100 text-slate-500"
          }`}
        >
          {rfq.status === "open" ? "مفتوح" : rfq.status}
        </span>
      </div>

      <div className="flex-1 px-5 py-3">
        {rfq.client_request_arabic && (
          <p className="mb-3 line-clamp-3 text-sm leading-relaxed text-slate-700">{rfq.client_request_arabic}</p>
        )}

        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
          <MapPin className="h-3.5 w-3.5 text-slate-400" />
          <span>{rfq.destination_port || "ميناء غير محدد"}</span>
        </div>

        <ProductsList products={products} loading={loadingProducts} extractedEntities={rfq.extracted_entities} />
      </div>

      <div className="border-t border-slate-100 px-5 py-3">
        <button
          onClick={onQuote}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-supplier-500 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-supplier-600 active:scale-[0.98]"
        >
          <Calculator className="h-4 w-4" />
          تقديم عرض سعر فوري
        </button>
      </div>
    </div>
  );
}
