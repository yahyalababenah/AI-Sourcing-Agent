import type { CalculatePriceResponse, LineItemResult } from "@/types/pricing";
import type { ProductInput } from "./usePricingCalculator";

interface PricingDetailBreakdownProps {
  result: CalculatePriceResponse;
  productInputs: Record<string, ProductInput>;
}

/** Full per-product breakdown + applied rules — supplementary detail below
 * the summary card. Kept separate from PricingResultCard because this is
 * real engine transparency (HS-code match, custom rules) with no equivalent
 * in the simple reference mockup; shared so it isn't duplicated between
 * PricingCalcPageDesktop/Mobile. */
export function PricingDetailBreakdown({ result, productInputs }: PricingDetailBreakdownProps) {
  const hasPenalty = result.line_items.some((li) => li.penalty_018 > 0);

  return (
    <div className="card p-6">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">تفاصيل المنتجات</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-end">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-xs font-medium text-slate-500">المنتج</th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500">الكمية</th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500">
                <span dir="ltr">سعر الوحدة (CNY)</span>
              </th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500">
                <span dir="ltr">سعر الوحدة (محول)</span>
              </th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500">الشحن</th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500">التأمين</th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500">الجمارك</th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500">التخليص</th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500">خدمات 070</th>
              {hasPenalty && <th className="px-3 py-2 text-xs font-medium text-red-600">غرامة 018</th>}
              <th className="px-3 py-2 text-xs font-medium text-slate-500">العمولة</th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500">الخصم</th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500">الإجمالي</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.line_items.map((item: LineItemResult, i: number) => {
              const enteredHsCode = productInputs[item.product_id]?.hs_code?.trim();
              return (
                <tr key={i} className="transition-colors duration-150 hover:bg-slate-50">
                  <td className="px-3 py-2 text-sm font-medium text-slate-900">
                    {item.product_name}
                    {enteredHsCode && !item.hs_code_matched && (
                      <p className="mt-0.5 text-xs font-normal text-amber-600">
                        ⚠️ الرمز غير موجود في الجدول — طُبّق رسم عام 5٪
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-700 tabular-nums">{item.quantity}</td>
                  <td className="px-3 py-2 text-sm text-slate-700 tabular-nums" dir="ltr">
                    {item.unit_price_cny.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-700 tabular-nums" dir="ltr">
                    {item.unit_price_converted.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-700 tabular-nums" dir="ltr">
                    {item.freight_cost.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-700 tabular-nums" dir="ltr">
                    {item.insurance_cost.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-700 tabular-nums" dir="ltr">
                    {item.customs_duty.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-700 tabular-nums" dir="ltr">
                    {item.clearance_fee.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-700 tabular-nums" dir="ltr">
                    {item.service_percent_070.toFixed(2)}
                  </td>
                  {hasPenalty && (
                    <td className="px-3 py-2 text-sm font-medium text-red-600 tabular-nums" dir="ltr">
                      {item.penalty_018 > 0 ? item.penalty_018.toFixed(2) : "—"}
                    </td>
                  )}
                  <td className="px-3 py-2 text-sm text-slate-700 tabular-nums" dir="ltr">
                    {item.commission.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-700 tabular-nums" dir="ltr">
                    {item.discount.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm font-semibold text-slate-900 tabular-nums" dir="ltr">
                    {item.total.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {result.custom_rules_applied.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">قواعد التسعير المخصصة المطبقة</h3>
          <div className="flex flex-wrap gap-2">
            {result.custom_rules_applied.map((r, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700"
              >
                {r.name}: <span dir="ltr" className="mr-1">{r.amount.toFixed(2)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {result.rules_applied.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">القواعد المطبقة</h3>
          <div className="flex flex-wrap gap-2">
            {result.rules_applied.map((rule, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700"
              >
                {rule}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
