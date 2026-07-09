import { useState, useRef, useEffect } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { LineRow } from "@/components/ui/LineRow";
import { Calculator, Plus, Trash2, Search, X } from "lucide-react";
import { useStandaloneCalculator, CURRENCIES, type StandaloneProductInput } from "./useStandaloneCalculator";
import type { CalculatePriceResponse } from "@/types/pricing";

// ── Formatting ──

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sum(items: CalculatePriceResponse["line_items"], key: keyof CalculatePriceResponse["line_items"][number]) {
  return items.reduce((acc, item) => acc + (item[key] as number), 0);
}

// ── HS-Code dropdown (mobile) ──

interface HSCodeDropdownProps {
  hsCode: string;
  hsCodeList: Array<{ hs_code: string; description?: string }>;
  onChange: (code: string) => void;
}

function HSCodeDropdown({ hsCode, hsCodeList, onChange }: HSCodeDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(hsCode);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = hsCodeList.filter(
    (h) =>
      h.hs_code.includes(query) ||
      (h.description && h.description.toLowerCase().includes(query.toLowerCase())),
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setQuery(hsCode);
  }, [hsCode]);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="بحث..."
          className="w-full rounded border border-slate-300 py-1.5 pr-8 pl-2 text-sm focus:border-supplier-500 focus:outline-none"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              onChange("");
            }}
            className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {filtered.map((h) => (
            <li
              key={h.hs_code}
              onClick={() => {
                onChange(h.hs_code);
                setQuery(h.hs_code);
                setOpen(false);
              }}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-supplier-50"
            >
              <span className="font-medium text-slate-800" dir="ltr">
                {h.hs_code}
              </span>
              {h.description && (
                <span className="mr-1 text-slate-500">— {h.description}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {open && query && filtered.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 shadow-lg">
          لا توجد نتائج
        </div>
      )}
    </div>
  );
}

// ── Mobile Product Card ──

interface ProductCardProps {
  product: StandaloneProductInput;
  index: number;
  hsCodeList: Array<{ hs_code: string; description?: string }>;
  onUpdate: (index: number, field: keyof StandaloneProductInput, value: unknown) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

function ProductCard({ product, index, hsCodeList, onUpdate, onRemove, canRemove }: ProductCardProps) {
  const lineTotal = product.quantity * product.unitPriceCny;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between">
        <h4 className="text-sm font-medium text-slate-900">منتج {index + 1}</h4>
        <button
          onClick={() => onRemove(index)}
          disabled={!canRemove}
          className="rounded p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">اسم المنتج</label>
          <input
            type="text"
            value={product.name}
            onChange={(e) => onUpdate(index, "name", e.target.value)}
            placeholder="اسم المنتج"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-supplier-500 focus:outline-none"
          />
        </div>

        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">رمز HS</label>
          <HSCodeDropdown
            hsCode={product.hsCode}
            hsCodeList={hsCodeList}
            onChange={(code) => onUpdate(index, "hsCode", code)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">الكمية</label>
          <input
            type="number"
            min={1}
            value={product.quantity}
            onChange={(e) => onUpdate(index, "quantity", Math.max(1, Number(e.target.value)))}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-center focus:border-supplier-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            <span dir="ltr">سعر الوحدة (CNY ¥)</span>
          </label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={product.unitPriceCny}
            onChange={(e) => onUpdate(index, "unitPriceCny", Math.max(0, Number(e.target.value)))}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-center focus:border-supplier-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">الوزن (كغ)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={product.weightKg}
            onChange={(e) => onUpdate(index, "weightKg", Math.max(0, Number(e.target.value)))}
            className={`w-full rounded border px-3 py-2 text-sm text-center focus:border-supplier-500 focus:outline-none ${
              product.weightKg <= 0 ? "border-amber-300 bg-amber-50" : "border-slate-300"
            }`}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            الحجم CBM
            <span className="mr-1 inline-flex cursor-help text-[10px] text-slate-400" title="أدخل الحجم بوحدة CBM أو اتركه للتقدير التلقائي">
              (?)
            </span>
          </label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={product.volumeCbm ?? ""}
            onChange={(e) =>
              onUpdate(index, "volumeCbm", e.target.value ? Number(e.target.value) : undefined)
            }
            placeholder="تلقائي"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-center focus:border-supplier-500 focus:outline-none"
          />
        </div>

        <div className="flex items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">الترخيص</label>
            <input
              type="checkbox"
              checked={product.hasLicense}
              onChange={(e) => onUpdate(index, "hasLicense", e.target.checked)}
              className="h-5 w-5 rounded border-slate-300"
            />
          </div>
          <div className="mr-auto text-left">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              <span dir="ltr">الإجمالي (CNY ¥)</span>
            </label>
            <span className="text-sm font-semibold text-slate-900 tabular-nums" dir="ltr">
              {fmt(lineTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mobile Page ──

export function StandaloneCalcPageMobile() {
  const {
    products,
    targetCurrency,
    setTargetCurrency,
    destinationPort,
    setDestinationPort,
    result,
    error,
    hsCodeList,
    addProduct,
    removeProduct,
    updateProduct,
    calculateMutation,
    createQuoteMutation,
    reset,
  } = useStandaloneCalculator();

  const hasResult = result !== null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">حاسبة التسعير المستقل</h1>
          <p className="mt-1 text-sm text-slate-500">
            إدخال بيانات المنتجات وحساب التكلفة بدون طلب عرض سعر
          </p>
        </div>
        {hasResult && (
          <button onClick={reset} className="btn-secondary text-xs">
            جديدة
          </button>
        )}
      </div>

      {/* Shipment info */}
      <div className="card p-4">
        <h2 className="mb-4 text-base font-semibold text-slate-900">بيانات الشحنة</h2>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">العملة المستهدفة</label>
            <select
              value={targetCurrency}
              onChange={(e) => setTargetCurrency(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors duration-150 focus:border-supplier-500 focus:outline-none"
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">ميناء الوصول</label>
            <input
              type="text"
              value={destinationPort}
              onChange={(e) => setDestinationPort(e.target.value)}
              placeholder="مثال: Aqaba, Jordan"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition-colors duration-150 focus:border-supplier-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="card p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">المنتجات</h2>
          <button onClick={addProduct} className="btn-primary text-sm flex items-center gap-1.5">
            <Plus className="h-4 w-4" />
            إضافة
          </button>
        </div>

        <div className="space-y-4">
          {products.map((product, i) => (
            <ProductCard
              key={i}
              product={product}
              index={i}
              hsCodeList={hsCodeList}
              onUpdate={updateProduct}
              onRemove={removeProduct}
              canRemove={products.length > 1}
            />
          ))}
        </div>

        {products.some((p) => p.weightKg <= 0) && (
          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            ⚠️ منتجات بدون وزن — سيُقدَّر الشحن بحد أدنى 0.1 CBM
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={() => calculateMutation.mutate()}
            disabled={calculateMutation.isPending}
            className="btn-primary w-full"
          >
            {calculateMutation.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                جاري الحساب...
              </span>
            ) : (
              "🧮 حساب التسعير"
            )}
          </button>
        </div>

        {error && <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      </div>

      {/* Result */}
      {hasResult ? (
        <>
          <MobileResultCard
            result={result}
            onCreateQuote={() => createQuoteMutation.mutate()}
            isCreatingQuote={createQuoteMutation.isPending}
          />
          <MobileDetailBreakdown result={result} productInputs={products} />
        </>
      ) : (
        <EmptyState
          icon={Calculator}
          title="حاسبة التسعير المستقل"
          description="أدخل بيانات المنتجات ثم اضغط 'حساب التسعير' لعرض التكلفة الواصلة"
        />
      )}
    </div>
  );
}

// ── Mobile Result Card ──

interface MobileResultCardProps {
  result: CalculatePriceResponse;
  onCreateQuote: () => void;
  isCreatingQuote: boolean;
}

function MobileResultCard({ result, onCreateQuote, isCreatingQuote }: MobileResultCardProps) {
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
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">التكلفة الواصلة المتوقعة</h2>
        {isFallback ? (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            ⚠️ تقدير محلي
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
            label="+ بدل خدمات 301"
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

      <div className="mt-4 rounded-lg border-2 border-supplier-100 bg-supplier-50 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-supplier-600">الإجمالي النهائي</span>
          <span className="text-2xl font-bold text-supplier-900 tabular-nums" dir="ltr">
            {fmt(result.grand_total)} {result.target_currency}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <button
          onClick={onCreateQuote}
          disabled={isCreatingQuote || isFallback}
          title={isFallback ? "أعد الاتصال بالخادم لإرسال عرض سعر دقيق" : undefined}
          className="btn-primary w-full"
        >
          {isCreatingQuote ? "جاري الإنشاء..." : "📄 إنشاء عرض سعر وإرسال"}
        </button>
      </div>
    </div>
  );
}

// ── Mobile Detail Breakdown ──

interface MobileDetailBreakdownProps {
  result: CalculatePriceResponse;
  productInputs: StandaloneProductInput[];
}

function MobileDetailBreakdown({ result, productInputs }: MobileDetailBreakdownProps) {
  const hasPenalty = result.line_items.some((li) => li.penalty_018 > 0);

  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">تفاصيل المنتجات</h3>

      {result.line_items.map((item, i) => {
        const enteredHsCode = productInputs[i]?.hsCode?.trim();
        return (
          <div key={i} className="mb-4 rounded-lg border border-slate-100 bg-slate-50/50 p-3 last:mb-0">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-900">
                {productInputs[i]?.name || item.product_name}
              </span>
              <span className="text-xs text-slate-500">المنتج {i + 1}</span>
            </div>
            {enteredHsCode && !item.hs_code_matched && (
              <p className="mb-2 text-xs text-amber-600">⚠️ الرمز غير موجود — طُبّق رسم عام 5٪</p>
            )}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <span className="text-slate-500">الكمية:</span>
              <span className="text-slate-900 tabular-nums text-left" dir="ltr">{item.quantity}</span>

              <span className="text-slate-500">
                <span dir="ltr">سعر الوحدة (CNY):</span>
              </span>
              <span className="text-slate-900 tabular-nums text-left" dir="ltr">{item.unit_price_cny.toFixed(2)}</span>

              <span className="text-slate-500">سعر الوحدة (محول):</span>
              <span className="text-slate-900 tabular-nums text-left" dir="ltr">{item.unit_price_converted.toFixed(2)}</span>

              <span className="text-slate-500">الشحن:</span>
              <span className="text-slate-900 tabular-nums text-left" dir="ltr">{item.freight_cost.toFixed(2)}</span>

              <span className="text-slate-500">التأمين:</span>
              <span className="text-slate-900 tabular-nums text-left" dir="ltr">{item.insurance_cost.toFixed(2)}</span>

              <span className="text-slate-500">CIF:</span>
              <span className="text-slate-900 tabular-nums text-left" dir="ltr">{item.cif_value.toFixed(2)}</span>

              <span className="text-slate-500">الجمارك:</span>
              <span className="text-slate-900 tabular-nums text-left" dir="ltr">{item.customs_duty.toFixed(2)}</span>

              <span className="text-slate-500">خدمات 070:</span>
              <span className="text-slate-900 tabular-nums text-left" dir="ltr">{item.service_percent_070.toFixed(2)}</span>

              <span className="text-slate-500">التخليص:</span>
              <span className="text-slate-900 tabular-nums text-left" dir="ltr">{item.clearance_fee.toFixed(2)}</span>

              <span className="text-slate-500">العمولة:</span>
              <span className="text-slate-900 tabular-nums text-left" dir="ltr">{item.commission.toFixed(2)}</span>

              {item.discount > 0 && (
                <>
                  <span className="text-slate-500">الخصم:</span>
                  <span className="text-slate-900 tabular-nums text-left" dir="ltr">{item.discount.toFixed(2)}</span>
                </>
              )}

              {hasPenalty && (
                <>
                  <span className="text-red-600">غرامة 018:</span>
                  <span className="text-red-600 tabular-nums text-left" dir="ltr">
                    {item.penalty_018 > 0 ? item.penalty_018.toFixed(2) : "—"}
                  </span>
                </>
              )}

              <span className="text-sm font-semibold text-slate-900">الإجمالي:</span>
              <span className="text-sm font-semibold text-slate-900 tabular-nums text-left" dir="ltr">
                {item.total.toFixed(2)}
              </span>
            </div>
          </div>
        );
      })}

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
