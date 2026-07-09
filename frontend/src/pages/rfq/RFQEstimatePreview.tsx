import { GlossaryTerm } from "@/components/ui/GlossaryTerm";
import { LineRow } from "@/components/ui/LineRow";
import type { CalculatePriceResponse } from "@/types/pricing";

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface RFQEstimatePreviewProps {
  estimate: CalculatePriceResponse | null;
}

/** "معاينة التكلفة التقديرية" — a live, client-side-only estimate shown
 * while filling the RFQ form (T8.1). There is no saved RFQ yet at this
 * point, so this cannot call the real pricing engine (which requires an
 * rfq_id) — it reuses the same local approximate calculation the real
 * calculator falls back to when the backend is unreachable, always labeled
 * as such rather than presented as a firm quote. Per CLAUDE.md: slate for
 * line items, brand-green reserved for the final total only. */
export function RFQEstimatePreview({ estimate }: RFQEstimatePreviewProps) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">معاينة التكلفة التقديرية</h2>
        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
          ⚠️ تقدير تقريبي أولي
        </span>
      </div>

      {estimate ? (
        <>
          <div className="mt-4">
            {estimate.line_items.map((item) => (
              <div key={item.product_id}>
                <LineRow
                  label={<GlossaryTerm term="FOB">سعر المنتج FOB</GlossaryTerm>}
                  value={<span dir="ltr">{fmt(item.unit_price_converted * item.quantity)}</span>}
                />
                <LineRow label={<GlossaryTerm term="Freight">+ الشحن الدولي</GlossaryTerm>} value={<span dir="ltr">{fmt(item.freight_cost)}</span>} muted />
                <LineRow label={<GlossaryTerm term="Insurance">+ التأمين</GlossaryTerm>} value={<span dir="ltr">{fmt(item.insurance_cost)}</span>} muted />
                <LineRow label={<GlossaryTerm term="Duty 001">+ الجمارك</GlossaryTerm>} value={<span dir="ltr">{fmt(item.customs_duty)}</span>} muted />
                <LineRow label={<GlossaryTerm term="Clearance">+ رسوم التخليص</GlossaryTerm>} value={<span dir="ltr">{fmt(item.clearance_fee)}</span>} muted />
                <LineRow label={<GlossaryTerm term="Commission">+ عمولة المندوب</GlossaryTerm>} value={<span dir="ltr">{fmt(item.commission)}</span>} muted />
              </div>
            ))}
            <LineRow label={<GlossaryTerm term="VAT">+ ضريبة القيمة المضافة</GlossaryTerm>} value={<span dir="ltr">{fmt(estimate.vat)}</span>} muted />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg border-2 border-brand-100 bg-brand-50 p-4">
            <span className="text-xs font-medium text-brand-600">الإجمالي التقديري</span>
            <span className="text-2xl font-bold text-brand-900 tabular-nums" dir="ltr">
              {fmt(estimate.grand_total)} {estimate.target_currency}
            </span>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            تقدير تقريبي محلي (<GlossaryTerm term="Duty 001">جمارك</GlossaryTerm> عامة 5٪، <GlossaryTerm term="Commission">عمولة</GlossaryTerm> 3٪، <GlossaryTerm term="VAT">ضريبة</GlossaryTerm> 16٪) — السعر النهائي الحقيقي يصلك من المندوب بعد
            مراجعة الطلب.
          </p>
        </>
      ) : (
        <div className="mt-4 rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-400">
          أدخل الكمية والسعر المستهدف للوحدة (بالعملة الصينية) لعرض تقدير للتكلفة
        </div>
      )}
    </div>
  );
}
