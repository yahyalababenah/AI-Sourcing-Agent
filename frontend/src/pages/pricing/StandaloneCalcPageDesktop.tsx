import { useState, useRef, useEffect } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { LineRow } from "@/components/ui/LineRow";
import { GlossaryTerm } from "@/components/ui/GlossaryTerm";
import { Calculator, Plus, Trash2, Search, X } from "lucide-react";
import { useStandaloneCalculator, CURRENCIES, type StandaloneProductInput } from "./useStandaloneCalculator";
import type { CalculatePriceResponse } from "@/types/pricing";

// ── Formatting helpers ──

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function sum(items: CalculatePriceResponse["line_items"], key: keyof CalculatePriceResponse["line_items"][number]) {
  return items.reduce((acc, item) => acc + (item[key] as number), 0);
}

// ── HS-Code dropdown sub-component ──

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
          className="w-full rounded border border-slate-300 py-1.5 pr-8 pl-2 text-xs focus:border-supplier-500 focus:outline-none"
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
              className="cursor-pointer px-3 py-2 text-xs hover:bg-supplier-50"
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
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-400 shadow-lg">
          لا توجد نتائج
        </div>
      )}
    </div>
  );
}

// ── Product row ──

interface ProductRowProps {
  product: StandaloneProductInput;
  index: number;
  hsCodeList: Array<{ hs_code: string; description?: string }>;
  onUpdate: (index: number, field: keyof StandaloneProductInput, value: unknown) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

function ProductRow({ product, index, hsCodeList, onUpdate, onRemove, canRemove }: ProductRowProps) {
  const lineTotal = product.quantity * product.unitPriceCny;
  return (
    <tr className="transition-colors duration-150 hover:bg-slate-50">
      <td className="px-3 py-2">
        <input
          type="text"
          value={product.name}
          onChange={(e) => onUpdate(index, "name", e.target.value)}
          placeholder="اسم المنتج"
          className="w-36 rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-supplier-500 focus:outline-none"
        />
      </td>
      <td className="px-3 py-2">
        <HSCodeDropdown
          hsCode={product.hsCode}
          hsCodeList={hsCodeList}
          onChange={(code) => onUpdate(index, "hsCode", code)}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={1}
          value={product.quantity}
          onChange={(e) => onUpdate(index, "quantity", Math.max(1, Number(e.target.value)))}
          className="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm text-center focus:border-supplier-500 focus:outline-none"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          step={0.01}
          value={product.unitPriceCny}
          onChange={(e) => onUpdate(index, "unitPriceCny", Math.max(0, Number(e.target.value)))}
          className="w-24 rounded border border-slate-300 px-2 py-1.5 text-sm text-center focus:border-supplier-500 focus:outline-none"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          step={0.01}
          value={product.weightKg}
          onChange={(e) => onUpdate(index, "weightKg", Math.max(0, Number(e.target.value)))}
          className={`w-20 rounded border px-2 py-1.5 text-sm text-center focus:border-supplier-500 focus:outline-none ${
            product.weightKg <= 0 ? "border-amber-300 bg-amber-50" : "border-slate-300"
          }`}
        />
      </td>
      <td className="px-3 py-2">
        <div className="relative">
          <input
            type="number"
            min={0}
            step={0.01}
            value={product.volumeCbm ?? ""}
            onChange={(e) =>
              onUpdate(index, "volumeCbm", e.target.value ? Number(e.target.value) : undefined)
            }
            placeholder="تلقائي"
            className="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm text-center focus:border-supplier-500 focus:outline-none"
          />
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500">
            ?
          </span>
        </div>
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={product.hasLicense}
          onChange={(e) => onUpdate(index, "hasLicense", e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
      </td>
      <td className="px-3 py-2 text-sm font-medium text-slate-900 tabular-nums">
        <span dir="ltr">{fmt(lineTotal)}</span>
      </td>
      <td className="px-3 py-2">
        <button
          onClick={() => onRemove(index)}
          disabled={!canRemove}
          className="rounded p-1.5 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
          title="حذف المنتج"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

// ── Desktop Page ──

export function StandaloneCalcPageDesktop() {
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
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">حاسبة التسعير المستقل</h1>
          <p className="mt-1 text-sm text-slate-500">
            إدخال بيانات المنتجات يدويًا وحساب التكلفة النهائية بدون طلب عرض سعر
          </p>
        </div>
        {hasResult && (
          <button onClick={reset} className="btn-secondary text-sm">
            بداية جديدة
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        {/* Main column */}
        <div className="space-y-6">
          {/* Shipment info */}
          <div className="card p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">بيانات الشحنة</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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

          {/* Products table */}
          <div className="card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">المنتجات</h2>
              <button onClick={addProduct} className="btn-primary text-sm flex items-center gap-1.5">
                <Plus className="h-4 w-4" />
                إضافة منتج
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-end">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    <th className="px-3 py-3 text-xs font-medium text-slate-500">المنتج</th>
                    <th className="px-3 py-3 text-xs font-medium text-slate-500"><GlossaryTerm term="HS Code">رمز HS</GlossaryTerm></th>
                    <th className="px-3 py-3 text-xs font-medium text-slate-500">الكمية</th>
                    <th className="px-3 py-3 text-xs font-medium text-slate-500">
                      <span dir="ltr">سعر الوحدة (CNY ¥)</span>
                    </th>
                    <th className="px-3 py-3 text-xs font-medium text-slate-500"><GlossaryTerm term="Weight">الوزن (كغ)</GlossaryTerm></th>
                    <th className="px-3 py-3 text-xs font-medium text-slate-500"><GlossaryTerm term="CBM">الحجم CBM</GlossaryTerm></th>
                    <th className="px-3 py-3 text-xs font-medium text-slate-500"><GlossaryTerm term="License">الترخيص</GlossaryTerm></th>
                    <th className="px-3 py-3 text-xs font-medium text-slate-500">
                      الإجمالي<span dir="ltr" className="mr-1">(CNY ¥)</span>
                    </th>
                    <th className="px-3 py-3 text-xs font-medium text-slate-500"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((product, i) => (
                    <ProductRow
                      key={i}
                      product={product}
                      index={i}
                      hsCodeList={hsCodeList}
                      onUpdate={updateProduct}
                      onRemove={removeProduct}
                      canRemove={products.length > 1}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {products.some((p) => p.weightKg <= 0) && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                ⚠️ منتجات بدون وزن — سيُقدَّر الشحن بحد أدنى 0.1 <GlossaryTerm term="CBM" /> بدلاً من الوزن الفعلي
              </div>
            )}

            <div className="mt-6 flex items-center gap-4">
              <button
                onClick={() => calculateMutation.mutate()}
                disabled={calculateMutation.isPending}
                className="btn-primary"
              >
                {calculateMutation.isPending ? (
                  <span className="flex items-center gap-2">
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

          {/* Detail breakdown */}
          {hasResult && <StandaloneDetailBreakdown result={result} productInputs={products} />}
        </div>

        {/* Sidebar — result summary */}
        <div className="h-fit lg:sticky lg:top-6">
          {hasResult ? (
            <StandaloneResultCard
              result={result}
              onCreateQuote={() => createQuoteMutation.mutate()}
              isCreatingQuote={createQuoteMutation.isPending}
            />
          ) : (
            <EmptyState
              icon={Calculator}
              title="حاسبة التسعير المستقل"
              description="أدخل بيانات المنتجات ثم اضغط 'حساب التسعير' لعرض التكلفة الواصلة"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Standalone Result Card ──

interface StandaloneResultCardProps {
  result: CalculatePriceResponse;
  onCreateQuote: () => void;
  isCreatingQuote: boolean;
}

function StandaloneResultCard({ result, onCreateQuote, isCreatingQuote }: StandaloneResultCardProps) {
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
        <LineRow label={<GlossaryTerm term="FOB">سعر المنتج FOB</GlossaryTerm>} value={<span dir="ltr">{fmt(fobTotal)}</span>} />
        <LineRow label={<GlossaryTerm term="Freight">+ الشحن الدولي</GlossaryTerm>} value={<span dir="ltr">{fmt(shippingTotal)}</span>} muted />
        <LineRow label={<GlossaryTerm term="Insurance">+ التأمين</GlossaryTerm>} value={<span dir="ltr">{fmt(insuranceTotal)}</span>} muted />
        <LineRow label={<GlossaryTerm term="Duty 001">+ الجمارك</GlossaryTerm>} value={<span dir="ltr">{fmt(customsTotal)}</span>} muted />
        {service070Total > 0 && (
          <LineRow label={<GlossaryTerm term="Service 070">+ رسوم خدمة 070</GlossaryTerm>} value={<span dir="ltr">{fmt(service070Total)}</span>} muted />
        )}
        <LineRow label={<GlossaryTerm term="Clearance">+ رسوم التخليص</GlossaryTerm>} value={<span dir="ltr">{fmt(clearanceTotal)}</span>} muted />
        <LineRow label={<GlossaryTerm term="VAT">+ ضريبة القيمة المضافة</GlossaryTerm>} value={<span dir="ltr">{fmt(result.vat)}</span>} muted />
        {result.service_flat_fee_301_total > 0 && (
          <LineRow
            label={<GlossaryTerm term="Service 301">+ بدل خدمات 301 (لكل شحنة)</GlossaryTerm>}
            value={<span dir="ltr">{fmt(result.service_flat_fee_301_total)}</span>}
            muted
          />
        )}
        {result.custom_fees_total !== 0 && (
          <LineRow label="+ رسوم قواعد مخصصة" value={<span dir="ltr">{fmt(result.custom_fees_total)}</span>} muted />
        )}
        {result.early_payment_discount > 0 && (
          <LineRow
            label={<GlossaryTerm term="Early Payment Discount">- خصم الدفع المبكر</GlossaryTerm>}
            value={<span dir="ltr">-{fmt(result.early_payment_discount)}</span>}
            muted
          />
        )}
        <LineRow label={<GlossaryTerm term="Commission">+ عمولة المندوب</GlossaryTerm>} value={<span dir="ltr">{fmt(commissionTotal)}</span>} muted />
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
          {isCreatingQuote ? "جاري الإنشاء..." : "📄 إنشاء عرض سعر وإرسال"}
        </button>
      </div>
    </div>
  );
}

// ── Standalone Detail Breakdown ──

interface StandaloneDetailBreakdownProps {
  result: CalculatePriceResponse;
  productInputs: StandaloneProductInput[];
}

function StandaloneDetailBreakdown({ result, productInputs }: StandaloneDetailBreakdownProps) {
  const hasPenalty = result.line_items.some((li) => li.penalty_018 > 0);

  return (
    <div className="card p-6">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">تفاصيل المنتجات</h3>

      {/* Phase 1: CIF breakdown */}
      <h4 className="mb-2 text-xs font-semibold text-slate-500">المرحلة 1: تفاصيل <GlossaryTerm term="CIF" /></h4>
      <div className="mb-4 overflow-x-auto">
        <table className="w-full text-end">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-xs font-medium text-slate-500">المنتج</th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500">
                <span dir="ltr">سعر الوحدة (CNY)</span>
              </th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500">
                <span dir="ltr">سعر الوحدة (محول)</span>
              </th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500"><GlossaryTerm term="Freight">الشحن</GlossaryTerm></th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500"><GlossaryTerm term="Insurance">التأمين</GlossaryTerm></th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500"><GlossaryTerm term="CIF" /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.line_items.map((item, i) => (
              <tr key={i} className="transition-colors duration-150 hover:bg-slate-50">
                <td className="px-3 py-2 text-sm font-medium text-slate-900">
                  {productInputs[i]?.name || item.product_name}
                </td>
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
                <td className="px-3 py-2 text-sm font-semibold text-slate-900 tabular-nums" dir="ltr">
                  {item.cif_value.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phase 2: Customs */}
      <h4 className="mb-2 text-xs font-semibold text-slate-500">المرحلة 2: الجمارك والرسوم</h4>
      <div className="mb-4 overflow-x-auto">
        <table className="w-full text-end">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-xs font-medium text-slate-500">المنتج</th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500"><GlossaryTerm term="Duty 001">رسم 001</GlossaryTerm></th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500"><GlossaryTerm term="Service 070">خدمات 070</GlossaryTerm></th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500"><GlossaryTerm term="Service 301">رسم 301</GlossaryTerm></th>
              {hasPenalty && <th className="px-3 py-2 text-xs font-medium text-red-600"><GlossaryTerm term="Penalty 018">غرامة 018</GlossaryTerm></th>}
              <th className="px-3 py-2 text-xs font-medium text-slate-500"><GlossaryTerm term="Clearance">التخليص</GlossaryTerm></th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500"><GlossaryTerm term="Commission">العمولة</GlossaryTerm></th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500">الخصم</th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500">الإجمالي</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.line_items.map((item, i) => {
              const enteredHsCode = productInputs[i]?.hsCode?.trim();
              return (
                <tr key={i} className="transition-colors duration-150 hover:bg-slate-50">
                  <td className="px-3 py-2 text-sm font-medium text-slate-900">
                    {productInputs[i]?.name || item.product_name}
                    {enteredHsCode && !item.hs_code_matched && (
                      <p className="mt-0.5 text-xs font-normal text-amber-600">
                        ⚠️ الرمز غير موجود — طُبّق رسم عام 5٪
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-700 tabular-nums" dir="ltr">
                    {item.customs_duty.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-700 tabular-nums" dir="ltr">
                    {item.service_percent_070.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-700 tabular-nums" dir="ltr">
                    {item.service_flat_301.toFixed(2)}
                  </td>
                  {hasPenalty && (
                    <td className="px-3 py-2 text-sm font-medium text-red-600 tabular-nums" dir="ltr">
                      {item.penalty_018 > 0 ? item.penalty_018.toFixed(2) : "—"}
                    </td>
                  )}
                  <td className="px-3 py-2 text-sm text-slate-700 tabular-nums" dir="ltr">
                    {item.clearance_fee.toFixed(2)}
                  </td>
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

      {/* Phase 3: VAT + Penalty */}
      <h4 className="mb-2 text-xs font-semibold text-slate-500">المرحلة 3: ضريبة القيمة المضافة والغرامات</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-end">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-xs font-medium text-slate-500">المنتج</th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500">المجموع قبل الضريبة</th>
              <th className="px-3 py-2 text-xs font-medium text-slate-500"><GlossaryTerm term="VAT">ضريبة القيمة المضافة</GlossaryTerm></th>
              {hasPenalty && <th className="px-3 py-2 text-xs font-medium text-red-600"><GlossaryTerm term="Penalty 018">غرامة 018</GlossaryTerm></th>}
              <th className="px-3 py-2 text-xs font-medium text-slate-500">المجموع النهائي</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {result.line_items.map((item, i) => (
              <tr key={i} className="transition-colors duration-150 hover:bg-slate-50">
                <td className="px-3 py-2 text-sm font-medium text-slate-900">
                  {productInputs[i]?.name || item.product_name}
                </td>
                <td className="px-3 py-2 text-sm text-slate-700 tabular-nums" dir="ltr">
                  {item.subtotal.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-sm text-slate-700 tabular-nums" dir="ltr">
                  {(item.total - item.subtotal).toFixed(2)}
                </td>
                {hasPenalty && (
                  <td className="px-3 py-2 text-sm font-medium text-red-600 tabular-nums" dir="ltr">
                    {item.penalty_018 > 0 ? item.penalty_018.toFixed(2) : "—"}
                  </td>
                )}
                <td className="px-3 py-2 text-sm font-semibold text-slate-900 tabular-nums" dir="ltr">
                  {item.total.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rules applied */}
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
