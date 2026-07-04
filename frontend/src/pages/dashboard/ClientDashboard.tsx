import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { intakeService } from "@/services/intakeService";
import { quotationService } from "@/services/quotationService";
import { ROUTES } from "@/constants/routes";

// ── Countdown timer ─────────────────────────────────────────────────────────
function useCountdown(targetMs: number) {
  const [remaining, setRemaining] = useState(() => Math.max(0, targetMs - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1000)), 1000);
    return () => clearInterval(id);
  }, [targetMs]);
  const h = String(Math.floor(remaining / 3_600_000)).padStart(2, "0");
  const m = String(Math.floor((remaining % 3_600_000) / 60_000)).padStart(2, "0");
  const s = String(Math.floor((remaining % 60_000) / 1000)).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_BADGES: Record<string, { bg: string; border: string; text: string }> = {
  open:       { bg: "#E0E7FF", border: "#C7D2FE", text: "#4338CA"  },
  processing: { bg: "var(--amber-surface)",  border: "var(--amber-border)",  text: "#d97706"  },
  quoted:     { bg: "#E0E7FF", border: "#C7D2FE", text: "#4338CA"  },
  closed:     { bg: "var(--surface-3)",      border: "var(--border)",        text: "var(--text-2)" },
};
const STATUS_LABELS: Record<string, string> = {
  open:       "قيد التنفيذ",
  processing: "في الانتظار",
  quoted:     "تم التسعير",
  closed:     "مغلق",
  cancelled:  "ملغي",
};

// ── Cost row helper ──────────────────────────────────────────────────────────
function CostRow({
  label, amount, color, delay, isTotal,
}: { label: string; amount: string; color: string; delay: string; isTotal?: boolean }) {
  if (isTotal) {
    // Financial totals are always green — the one deliberate color exception
    // to the slate-only rule for money (see CLAUDE.md).
    return (
      <div
        className="flex items-center justify-between px-4 py-3 bg-supplier-50"
        style={{ borderTop: "1px solid #9FE1CB", animation: `totalReveal 0.4s ease ${delay} both` }}
      >
        <span className="text-[13px] font-bold text-supplier-900">إجمالي التكلفة</span>
        <span className="text-[17px] font-black font-mono text-supplier-500" style={{ fontVariantNumeric: "tabular-nums" }} dir="ltr">
          {amount}
        </span>
      </div>
    );
  }
  return (
    <div
      className="flex items-center justify-between px-4 py-2"
      style={{ borderBottom: "1px solid var(--surface-3)", animation: `costIn 0.35s ease ${delay} both` }}
    >
      <div className="flex items-center gap-2" dir="rtl">
        <div className="w-1.5 h-1.5 rounded-sm" style={{ background: color }} />
        <span className="text-[11px]" style={{ color: "var(--text-2)" }}>{label}</span>
      </div>
      <span className="text-[11.5px] font-semibold font-mono" style={{ color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }} dir="ltr">
        {amount}
      </span>
    </div>
  );
}

// ── RFQ card ─────────────────────────────────────────────────────────────────
function RfqCard({ rfq, onNavigate }: { rfq: any; onNavigate: () => void }) {
  const isWaiting = rfq.status === "processing";
  const deadline = Date.now() + 18.7 * 3_600_000;
  const countdown = useCountdown(isWaiting ? deadline : 0);
  const sc = STATUS_BADGES[rfq.status] ?? STATUS_BADGES.closed;

  return (
    <div
      onClick={onNavigate}
      className="rounded-lg p-3.5 cursor-pointer transition-all hover:shadow-sm mb-2"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      dir="rtl"
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="text-[12.5px] font-semibold mb-0.5" style={{ color: "var(--text-1)" }}>
            {rfq.client_request_arabic?.split("\n")[0]?.replace("المنتج: ", "") || "طلب توريد"}
          </div>
          <div className="text-[11px]" style={{ color: "var(--text-3)" }}>
            {rfq.client_name || "العميل"} · {rfq.quantity ?? "500"} وحدة
          </div>
        </div>
        <div
          className="text-[10px] font-semibold px-2 py-0.5 rounded shrink-0"
          style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}
        >
          {STATUS_LABELS[rfq.status] ?? rfq.status}
        </div>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[12px] font-bold font-mono" style={{ color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }} dir="ltr">
          ${(rfq.amount ?? 11200).toLocaleString()}
        </span>
        {isWaiting ? (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#d97706", animation: "dotPulse 1.5s ease infinite" }} />
            <span className="text-[10px] font-mono" style={{ color: "#d97706", fontVariantNumeric: "tabular-nums" }} dir="ltr">
              {countdown} متبقية
            </span>
          </div>
        ) : (
          <span className="text-[10px]" style={{ color: "var(--text-3)" }}>
            {new Date(rfq.created_at).toLocaleDateString("ar-SA-u-ca-gregory")}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function ClientDashboard() {
  const user     = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const rfqQuery = useQuery({
    queryKey: ["my-rfqs"],
    queryFn:  () => intakeService.list({ limit: 50 }),
    staleTime: 15_000,
  });

  // Latest quotation drives the landed-cost hero card with real figures —
  // no placeholder amounts.
  const latestQuoteQuery = useQuery({
    queryKey: ["client-latest-quote"],
    queryFn:  () => quotationService.list({ limit: 1 }),
    staleTime: 15_000,
  });
  const latestQuote = latestQuoteQuery.data?.items?.[0];

  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [quantity,    setQuantity]    = useState<number>(500);
  const [formError,   setFormError]   = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      intakeService.create({
        client_name:           user?.full_name || "",
        client_request_arabic: `المنتج: ${productName}\nالوصف: ${description}\nالكمية: ${quantity}`,
        destination_port:      "العقبة",
        target_currency:       "JOD",
      }),
    onSuccess: () => {
      setProductName(""); setDescription(""); setQuantity(500); setFormError(null);
      rfqQuery.refetch();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const today = new Date().toLocaleDateString("ar-SA-u-ca-gregory", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const rfqs = rfqQuery.data?.items ?? [];

  // Real cost breakdown from the client's latest quotation — falls back to
  // an empty list (rendered as an empty state below) when none exists yet.
  const costRows = latestQuote
    ? [
        latestQuote.freight_total != null && { label: "+ الشحن الدولي", amount: `${latestQuote.freight_total.toFixed(2)}`, color: "#4a7ab8", delay: "0.15s" },
        latestQuote.customs_total != null && { label: "+ الجمارك",      amount: `${latestQuote.customs_total.toFixed(2)}`, color: "#c9882a", delay: "0.28s" },
        latestQuote.vat_total != null &&      { label: "+ ضريبة القيمة", amount: `${latestQuote.vat_total.toFixed(2)}`,     color: "#c86b3a", delay: "0.41s" },
        latestQuote.commission_total != null && { label: "+ العمولة",   amount: `${latestQuote.commission_total.toFixed(2)}`, color: "#9a4a7a", delay: "0.54s" },
        latestQuote.discount_total != null && latestQuote.discount_total > 0 &&
          { label: "- الخصم", amount: `-${latestQuote.discount_total.toFixed(2)}`, color: "#3a8a8a", delay: "0.67s" },
      ].filter(Boolean) as { label: string; amount: string; color: string; delay: string }[]
    : [];

  const inputStyle = {
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    color: "var(--text-1)",
  } as React.CSSProperties;

  return (
    <div className="space-y-5" dir="rtl">
      {/* Greeting */}
      <div>
        <h2 className="text-[22px] font-bold" style={{ color: "var(--text-1)" }}>
          مرحباً، {user?.full_name || "أحمد"}
        </h2>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--text-2)" }}>{today}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ── Landed Cost Hero Card ── */}
        <div
          className="rounded-xl overflow-hidden shadow-sm"
          style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
        >
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between bg-importer-500" dir="rtl">
            <div>
              <div className="text-[13px] font-bold text-white mb-0.5">تكلفة الهبوط المتوقعة</div>
              <div className="text-[11px] text-white/75">
                {latestQuote ? `عرض السعر ${latestQuote.quotation_number}` : "لا يوجد عرض سعر بعد"}
              </div>
            </div>
          </div>

          {/* Cost rows */}
          {latestQuoteQuery.isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded" style={{ background: "var(--surface-3)" }} />
              ))}
            </div>
          ) : latestQuote ? (
            <div>
              {costRows.map((row) => (
                <CostRow key={row.label} {...row} />
              ))}
              <CostRow label="" amount={`${latestQuote.grand_total.toFixed(2)} ${latestQuote.target_currency}`} color="" delay="0.8s" isTotal />
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-[12px]" style={{ color: "var(--text-3)" }}>
              قدّم طلب عرض سعر لعرض تكلفة الهبوط المتوقعة هنا
            </div>
          )}

          <div className="p-3">
            <button
              onClick={() => navigate(ROUTES.RFQ.CREATE)}
              className="w-full py-3 text-[13px] font-bold text-white rounded-lg transition-all bg-importer-500 hover:bg-importer-600"
            >
              تقديم طلب عرض السعر
            </button>
          </div>
        </div>

        {/* ── RFQ List + Quick Create ── */}
        <div className="space-y-4">
          {/* Quick RFQ form */}
          <div
            className="rounded-xl p-5 shadow-sm"
            style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
          >
            <h3 className="text-[14px] font-bold mb-4" style={{ color: "var(--text-1)" }}>
              طلب عرض سعر جديد
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!productName.trim()) return setFormError("يرجى إدخال اسم المنتج");
                setFormError(null);
                createMutation.mutate();
              }}
              className="space-y-3"
            >
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="اسم المنتج (مثال: أجهزة إلكترونية)"
                className="w-full px-3 py-2.5 text-[13px] rounded-lg outline-none focus:border-importer-500"
                style={inputStyle}
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="المواصفات والتفاصيل..."
                rows={2}
                className="w-full px-3 py-2.5 text-[13px] rounded-lg outline-none resize-none focus:border-importer-500"
                style={inputStyle}
              />
              <div className="flex gap-3">
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="flex-1 px-3 py-2.5 text-[13px] rounded-lg outline-none focus:border-importer-500"
                  style={inputStyle}
                  placeholder="الكمية"
                />
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 py-2.5 text-[13px] font-bold text-white rounded-lg transition-all bg-importer-500 hover:bg-importer-600 disabled:opacity-60"
                >
                  {createMutation.isPending ? "جاري الإرسال..." : "إرسال الطلب"}
                </button>
              </div>
              {formError && (
                <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
              )}
              {createMutation.isSuccess && (
                <p className="text-[12px] text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">✓ تم إرسال الطلب بنجاح</p>
              )}
            </form>
          </div>

          {/* RFQs list */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-bold" style={{ color: "var(--text-1)" }}>
                طلبات عروض الأسعار
              </h3>
              <button
                onClick={() => navigate(ROUTES.RFQ.LIST)}
                className="text-[11px] font-medium text-importer-600"
              >
                عرض الكل
              </button>
            </div>

            {rfqQuery.isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-lg" style={{ background: "var(--surface-3)" }} />
                ))}
              </div>
            ) : rfqs.length > 0 ? (
              rfqs.slice(0, 4).map((rfq) => (
                <RfqCard
                  key={rfq.id}
                  rfq={rfq}
                  onNavigate={() => navigate(ROUTES.RFQ.DETAIL(rfq.id))}
                />
              ))
            ) : (
              <div
                className="rounded-lg p-6 text-center text-[13px]"
                style={{ border: "1px solid var(--border)", color: "var(--text-3)" }}
              >
                لا توجد طلبات بعد — ابدأ بطلب جديد
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
