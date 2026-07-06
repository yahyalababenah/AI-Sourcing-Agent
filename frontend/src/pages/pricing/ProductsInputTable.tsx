import type { Product } from "@/types/intake";
import type { ProductInput } from "./usePricingCalculator";

interface ProductsInputTableProps {
  products: Product[];
  productInputs: Record<string, ProductInput>;
  setProductInputs: (
    updater: (prev: Record<string, ProductInput>) => Record<string, ProductInput>,
  ) => void;
}

/** The per-product override table ("٢. تعديل المنتجات") — shared between
 * PricingCalcPageDesktop and PricingCalcPageMobile so the real multi-product
 * RFQ flow (quantity/unit price/weight/HS code/license per line) isn't
 * duplicated between the two layout files. */
export function ProductsInputTable({ products, productInputs, setProductInputs }: ProductsInputTableProps) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-end">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">المنتج</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">المواصفات</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">الكمية</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">
                <span dir="ltr">سعر الوحدة (CNY ¥)</span>
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">الوزن (كغ/وحدة)</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">رمز HS</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">أملك الترخيص</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">
                الإجمالي<span dir="ltr" className="mr-1">(CNY ¥)</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((p) => {
              const input = productInputs[p.id] || {
                quantity: 1,
                unit_price_cny: 0,
                weight_kg: 0,
                hs_code: "",
                has_license: false,
              };
              const lineTotal = input.quantity * input.unit_price_cny;
              return (
                <tr key={p.id} className="transition-colors duration-150 hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{p.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{p.specifications || "—"}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={1}
                      value={input.quantity}
                      onChange={(e) =>
                        setProductInputs((prev) => ({
                          ...prev,
                          [p.id]: { ...prev[p.id], quantity: Math.max(1, Number(e.target.value)) },
                        }))
                      }
                      className="w-20 rounded border border-slate-300 px-2 py-1 text-sm text-center focus:border-supplier-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={input.unit_price_cny}
                      onChange={(e) =>
                        setProductInputs((prev) => ({
                          ...prev,
                          [p.id]: { ...prev[p.id], unit_price_cny: Math.max(0, Number(e.target.value)) },
                        }))
                      }
                      className="w-24 rounded border border-slate-300 px-2 py-1 text-sm text-center focus:border-supplier-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={input.weight_kg}
                      onChange={(e) =>
                        setProductInputs((prev) => ({
                          ...prev,
                          [p.id]: { ...prev[p.id], weight_kg: Math.max(0, Number(e.target.value)) },
                        }))
                      }
                      className={`w-24 rounded border px-2 py-1 text-sm text-center focus:border-supplier-500 focus:outline-none ${
                        input.weight_kg <= 0 ? "border-amber-300 bg-amber-50" : "border-slate-300"
                      }`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={input.hs_code}
                      onChange={(e) =>
                        setProductInputs((prev) => ({ ...prev, [p.id]: { ...prev[p.id], hs_code: e.target.value } }))
                      }
                      placeholder="اختياري"
                      className="w-32 rounded border border-slate-300 px-2 py-1 text-sm text-center focus:border-supplier-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={input.has_license}
                      onChange={(e) =>
                        setProductInputs((prev) => ({
                          ...prev,
                          [p.id]: { ...prev[p.id], has_license: e.target.checked },
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 tabular-nums">
                    <span dir="ltr">{lineTotal.toFixed(2)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {Object.values(productInputs).some((v) => v.weight_kg <= 0) && (
        <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          ⚠️ منتجات بدون وزن — سيُقدَّر الشحن بحد أدنى 0.1 CBM بدلاً من الوزن الفعلي
        </div>
      )}
    </>
  );
}
