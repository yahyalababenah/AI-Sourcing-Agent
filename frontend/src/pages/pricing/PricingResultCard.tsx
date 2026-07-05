import { LineRow } from "@/components/ui/LineRow";
import type { CalculatePriceResponse } from "@/types/pricing";

// Formats a currency amount the way the reference design does — thousands
// separators + 2 decimals, always LTR so digits/commas read correctly inside
// an RTL page (see CLAUDE.md's tabular-nums rule).
function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sum(items: CalculatePriceResponse["line_items"], key: keyof CalculatePriceResponse["line_items"][number]) {
  return items.reduce((acc, item) => acc + (item[key] as number), 0);
}

interface PricingResultCardProps {
  result: CalculatePriceResponse;
  onViewRfq: () => void;
  onCreateQuote: () => void;
  isCreatingQuote: boolean;
}

/** The "التكلفة الواصلة المتوقعة" summary card — shared between
 * PricingCalcPageDesktop (sticky side column) and PricingCalcPageMobile
 * (stacked below the form), matching pricing-calculator-*.html. Real
 * per-line fees (070 service, 301 flat fee, custom rules) are shown when the
 * engine actually returned them — not folded away for the sake of matching
 * the reference's simpler shape. */
export function PricingResultCard({ result, onViewRfq, onCreateQuote, isCreatingQuote }: PricingResultCardProps) {
  const isFallback = result.is_local_fallback === true;
  const items = result.line_items;
  const totalQuantity = sum(items, "quantity");
  const fobTotal = items.reduce((acc, item) => acc + item.unit_price_converted * item.quantity, 0);
  const shippingTotal = sum(items, "freight_cost");
  const insuranceTotal = sum(items, "insurance_cost");
  const customsTotal = sum(items, "customs_duty");
  const service070Total = sum(items, "service_percent_070");
  const clearanceTotal = sum(items, "clearance_fee");
  const commissionTotal = sum(items, "commission");

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">التكلفة الواصلة المتوقعة</h2>
        {isFallback ? (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            ⚠️ تقدير محلي — غير متصل بالخادم
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-supplier-50 px-2 py-0.5 text-[11px] font-medium text-supplier-600">
            دقة 0.82%
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-400">
        {items.length} منتج — <span dir="ltr">{totalQuantity}</span> وحدة
      </p>

      <div className="mt-4">
        <LineRow label="سعر المنتج FOB" value={<span dir="ltr">{fmt(fobTotal)}</span>} />
        <LineRow label="+ الشحن الدولي" value={<span dir="ltr">{fmt(shippingTotal)}</span>} muted />
        <LineRow label="+ التأمين" value={<span dir="ltr">{fmt(insuranceTotal)}</span>} muted />
        <LineRow label="+ الجمارك" value={<span dir="ltr">{fmt(customsTotal)}</span>} muted />
        {service070Total > 0 && (
          <LineRow label="+ رسوم خدمة 070" value={<span dir="ltr">{fmt(service070Total)}</span>} muted />
        )}
        <LineRow label="+ رسوم التخليص" value={<span dir="ltr">{fmt(clearanceTotal)}</span>} muted />
        <LineRow label="+ ضريبة القيمة المضافة" value={<span dir="ltr">{fmt(result.vat)}</span>} muted />
        {result.service_flat_fee_301_total > 0 && (
          <LineRow
            label="+ بدل خدمات 301 (لكل شحنة)"
            value={<span dir="ltr">{fmt(result.service_flat_fee_301_total)}</span>}
            muted
          />
        )}
        {result.custom_fees_total !== 0 && (
          <LineRow label="+ رسوم قواعد مخصصة" value={<span dir="ltr">{fmt(result.custom_fees_total)}</span>} muted />
        )}
        {result.early_payment_discount > 0 && (
          <LineRow
            label="- خصم الدفع المبكر"
            value={<span dir="ltr">-{fmt(result.early_payment_discount)}</span>}
            muted
          />
        )}
        <LineRow label="+ عمولة المندوب" value={<span dir="ltr">{fmt(commissionTotal)}</span>} muted />
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg border-2 border-supplier-100 bg-supplier-50 p-4">
        <span className="text-xs font-medium text-supplier-600">الإجمالي النهائي</span>
        <span className="text-2xl font-bold text-supplier-900 tabular-nums" dir="ltr">
          {fmt(result.grand_total)} {result.target_currency}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <button
          onClick={onCreateQuote}
          disabled={isCreatingQuote || isFallback}
          title={isFallback ? "أعد الاتصال بالخادم لإرسال عرض سعر دقيق" : undefined}
          className="btn-primary w-full"
        >
          {isCreatingQuote ? "جاري الإنشاء..." : "📄 إرسال كعرض سعر للعميل"}
        </button>
        <button onClick={onViewRfq} className="btn-secondary w-full">
          عرض طلب عرض السعر
        </button>
      </div>
    </div>
  );
}
