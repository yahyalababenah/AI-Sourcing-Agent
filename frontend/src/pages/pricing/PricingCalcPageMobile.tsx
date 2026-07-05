import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { intakeService } from "@/services/intakeService";
import { pricingService } from "@/services/pricingService";
import { quotationService } from "@/services/quotationService";
import { ROUTES } from "@/constants/routes";
import type {
  CalculatePriceResponse,
  LineItemResult,
  PriceProductInput,
} from "@/types/pricing";

// Only JOD/USD are actually supported by the pricing engine — any other
// currency silently falls back to JOD math (see engine.py's currency branch).
const CURRENCIES = [
  { value: "JOD", label: "دينار أردني (JOD)" },
  { value: "USD", label: "دولار أمريكي (USD)" },
];

export function PricingCalcPageMobile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ── Step state ──────────────────────────────────────────
  const [selectedRfqId, setSelectedRfqId] = useState(
    searchParams.get("rfq_id") ?? ""
  );
  const [targetCurrency, setTargetCurrency] = useState("JOD");
  const [destinationPort, setDestinationPort] = useState("");
  const [productInputs, setProductInputs] = useState<
    Record<
      string,
      { quantity: number; unit_price_cny: number; weight_kg: number; hs_code: string; has_license: boolean }
    >
  >({});
  const [result, setResult] = useState<CalculatePriceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch RFQs for dropdown ─────────────────────────────
  const { data: rfqsData, isLoading: rfqsLoading } = useQuery({
    queryKey: ["rfqs", "all", 1],
    queryFn: () => intakeService.list({ limit: 100 }),
  });

  // Auto-select RFQ from URL param when data loads
  const rfqFromUrl = searchParams.get("rfq_id");
  useEffect(() => {
    if (
      rfqFromUrl &&
      rfqsData?.items &&
      !selectedRfqId &&
      rfqsData.items.some((r) => r.id === rfqFromUrl)
    ) {
      setSelectedRfqId(rfqFromUrl);
    }
  }, [rfqFromUrl, rfqsData, selectedRfqId]);

  // ── Fetch products when RFQ selected ────────────────────
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["rfq-products", selectedRfqId],
    queryFn: () => intakeService.listProducts(selectedRfqId),
    enabled: !!selectedRfqId,
  });

  // ── Initialise product inputs when products load ────────
  const handleRfqChange = (rfqId: string) => {
    setSelectedRfqId(rfqId);
    setProductInputs({});
    setResult(null);
    setError(null);
  };

  // Populate inputs whenever products data changes
  if (products && Object.keys(productInputs).length === 0 && selectedRfqId) {
    const inputs: Record<
      string,
      { quantity: number; unit_price_cny: number; weight_kg: number; hs_code: string; has_license: boolean }
    > = {};
    for (const p of products) {
      inputs[p.id] = {
        quantity: p.quantity ?? 1,
        unit_price_cny: 0,
        weight_kg: p.weight_kg ?? 0,
        hs_code: "",
        has_license: false,
      };
    }
    // Only set if not already set (prevents re-render loop)
    if (JSON.stringify(productInputs) !== JSON.stringify(inputs)) {
      // Defer to avoid setState during render
      setTimeout(() => setProductInputs(inputs), 0);
    }
  }

  // ── Calculate mutation ──────────────────────────────────
  const calculateMutation = useMutation({
    mutationFn: () => {
      if (!selectedRfqId || !destinationPort.trim()) {
        throw new Error("يرجى اختيار طلب عرض السعر وتعبئة ميناء الوصول");
      }
      const productsPayload: PriceProductInput[] = Object.entries(productInputs).map(
        ([productId, vals]) => {
          const prod = products?.find((p) => p.id === productId);
          return {
            product_id: productId,
            name: prod?.name || productId,
            quantity: vals.quantity,
            unit_price_cny: vals.unit_price_cny,
            weight_kg: vals.weight_kg,
            hs_code: vals.hs_code.trim() || undefined,
            has_license: vals.has_license,
          };
        }
      );
      if (productsPayload.length === 0) {
        throw new Error("لا توجد منتجات للحساب");
      }
      return pricingService.calculate({
        rfq_id: selectedRfqId,
        target_currency: targetCurrency,
        destination_port: destinationPort.trim(),
        products: productsPayload,
      });
    },
    onSuccess: (data) => {
      setResult(data);
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
      setResult(null);
    },
  });

  // ── Create quotation from results ───────────────────────
  const createQuoteMutation = useMutation({
    mutationFn: () => {
      if (!result) throw new Error("ليس هناك نتائج للحساب");
      return quotationService.create({
        rfq_id: result.rfq_id,
        target_currency: result.target_currency,
        exchange_rate_used: result.exchange_rate_used,
        line_items: result.line_items.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price_cny: item.unit_price_cny,
          unit_price_converted: item.unit_price_converted,
          exchange_rate: item.exchange_rate,
          freight_cost: item.freight_cost,
          customs_duty: item.customs_duty,
          commission: item.commission,
          subtotal: item.subtotal,
          discount: item.discount,
          total: item.total,
        })),
        subtotal: result.subtotal_before_vat,
        vat_total: result.vat,
        discount_total: result.discount_total,
        grand_total: result.grand_total,
      });
    },
    onSuccess: (quote) => {
      navigate(ROUTES.QUOTES.DETAIL(quote.id));
    },
  });

  // ── Helpers ──────────────────────────────────────────────
  const selectedRfq = rfqsData?.items?.find((r) => r.id === selectedRfqId);
  const hasProducts = products && products.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">حاسبة التسعير</h1>
        <p className="mt-1 text-sm text-gray-500">
          حساب التكلفة النهائية لاستيراد المنتجات مع تطبيق قواعد التسعير
        </p>
      </div>

      {/* Step 1: Select RFQ */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          ١. اختيار طلب عرض السعر
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              طلب عرض السعر
            </label>
            {rfqsLoading ? (
              <div className="flex h-10 items-center text-sm text-gray-400">
                جاري التحميل...
              </div>
            ) : (
              <select
                value={selectedRfqId}
                onChange={(e) => handleRfqChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-supplier-500 focus:outline-none"
              >
                <option value="">-- اختر طلب عرض سعر --</option>
                {rfqsData?.items?.map((rfq) => (
                  <option key={rfq.id} value={rfq.id}>
                    {rfq.client_name}
                    {rfq.destination_port ? ` - ${rfq.destination_port}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              العملة المستهدفة
            </label>
            <select
              value={targetCurrency}
              onChange={(e) => setTargetCurrency(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-supplier-500 focus:outline-none"
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              ميناء الوصول
            </label>
            <input
              type="text"
              value={destinationPort}
              onChange={(e) => setDestinationPort(e.target.value)}
              placeholder="مثال: Aqaba, Jordan"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-supplier-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Step 2: Products */}
      {selectedRfqId && (
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            ٢. تعديل المنتجات
          </h2>

          {productsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-supplier-100 border-t-supplier-600" />
            </div>
          ) : !hasProducts ? (
            <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
              {selectedRfq
                ? `لا توجد منتجات مستخرجة لطلب عرض السعر "${selectedRfq.client_name}". يرجى تحميل مستند أولاً.`
                : "لم يتم العثور على منتجات"}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="border-b border-gray-100 bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500">
                        المنتج
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500">
                        المواصفات
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500">
                        الكمية
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500">
                        <span dir="ltr">سعر الوحدة (CNY ¥)</span>
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500">
                        الوزن (كغ/وحدة)
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500">
                        رمز HS
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500">
                        أملك الترخيص
                      </th>
                      <th className="px-4 py-3 text-xs font-medium text-gray-500">
                        الإجمالي
                        <span dir="ltr" className="mr-1">(CNY ¥)</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
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
                        <tr key={p.id} className="transition-colors hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {p.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {p.specifications || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min={1}
                              value={input.quantity}
                              onChange={(e) =>
                                setProductInputs((prev) => ({
                                  ...prev,
                                  [p.id]: {
                                    ...prev[p.id],
                                    quantity: Math.max(1, Number(e.target.value)),
                                  },
                                }))
                              }
                              className="w-20 rounded border border-gray-300 px-2 py-1 text-sm text-center focus:border-supplier-500 focus:outline-none"
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
                                  [p.id]: {
                                    ...prev[p.id],
                                    unit_price_cny: Math.max(0, Number(e.target.value)),
                                  },
                                }))
                              }
                              className="w-24 rounded border border-gray-300 px-2 py-1 text-sm text-center focus:border-supplier-500 focus:outline-none"
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
                                  [p.id]: {
                                    ...prev[p.id],
                                    weight_kg: Math.max(0, Number(e.target.value)),
                                  },
                                }))
                              }
                              className={`w-24 rounded border px-2 py-1 text-sm text-center focus:border-supplier-500 focus:outline-none ${
                                input.weight_kg <= 0 ? "border-amber-300 bg-amber-50" : "border-gray-300"
                              }`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={input.hs_code}
                              onChange={(e) =>
                                setProductInputs((prev) => ({
                                  ...prev,
                                  [p.id]: {
                                    ...prev[p.id],
                                    hs_code: e.target.value,
                                  },
                                }))
                              }
                              placeholder="اختياري"
                              className="w-32 rounded border border-gray-300 px-2 py-1 text-sm text-center focus:border-supplier-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={input.has_license}
                              onChange={(e) =>
                                setProductInputs((prev) => ({
                                  ...prev,
                                  [p.id]: {
                                    ...prev[p.id],
                                    has_license: e.target.checked,
                                  },
                                }))
                              }
                              className="h-4 w-4 rounded border-gray-300"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
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
            </>
          )}

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Results */}
      {result && (
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            ٣. نتيجة حساب التسعير
          </h2>

          {/* Summary Cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">سعر الصرف</p>
              <p className="mt-1 text-xl font-bold text-gray-900">
                <span dir="ltr">1 CNY = {result.exchange_rate_used}</span>
              </p>
              <p className="text-xs text-gray-400" dir="ltr">
                {result.target_currency}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">الإجمالي قبل الضريبة</p>
              <p className="mt-1 text-xl font-bold text-gray-900">
                <span dir="ltr">{result.subtotal_before_vat.toFixed(2)}</span>
              </p>
              <p className="text-xs text-gray-400" dir="ltr">
                {result.target_currency}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">ضريبة القيمة المضافة</p>
              <p className="mt-1 text-xl font-bold text-gray-900">
                <span dir="ltr">{result.vat.toFixed(2)}</span>
              </p>
              <p className="text-xs text-gray-400" dir="ltr">
                {result.target_currency}
              </p>
            </div>
            <div className="rounded-lg border-2 border-supplier-100 bg-supplier-50 p-4">
              <p className="text-xs font-medium text-supplier-600">
                الإجمالي النهائي
              </p>
              <p className="mt-1 text-2xl font-bold text-supplier-900">
                <span dir="ltr">{result.grand_total.toFixed(2)}</span>
              </p>
              <p className="text-xs font-medium text-supplier-600" dir="ltr">
                {result.target_currency}
              </p>
            </div>
          </div>

          {/* Line Items Table */}
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            تفاصيل المنتجات
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500">المنتج</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500">الكمية</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500">
                    <span dir="ltr">سعر الوحدة (CNY)</span>
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500">
                    <span dir="ltr">سعر الوحدة (محول)</span>
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500">الشحن</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500">التأمين</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500">الجمارك</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500">التخليص</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500">
                    خدمات 070
                  </th>
                  {result.line_items.some((li) => li.penalty_018 > 0) && (
                    <th className="px-3 py-2 text-xs font-medium text-red-600">
                      غرامة 018
                    </th>
                  )}
                  <th className="px-3 py-2 text-xs font-medium text-gray-500">العمولة</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500">الخصم</th>
                  <th className="px-3 py-2 text-xs font-medium text-gray-500">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {result.line_items.map((item: LineItemResult, i: number) => {
                  const enteredHsCode = productInputs[item.product_id]?.hs_code?.trim();
                  return (
                  <tr key={i} className="transition-colors hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">
                      {item.product_name}
                      {enteredHsCode && !item.hs_code_matched && (
                        <p className="mt-0.5 text-xs font-normal text-amber-600">
                          ⚠️ الرمز غير موجود في الجدول — طُبّق رسم عام 5٪
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700">{item.quantity}</td>
                    <td className="px-3 py-2 text-sm text-gray-700" dir="ltr">
                      {item.unit_price_cny.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700" dir="ltr">
                      {item.unit_price_converted.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700" dir="ltr">
                      {item.freight_cost.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700" dir="ltr">
                      {item.insurance_cost.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700" dir="ltr">
                      {item.customs_duty.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700" dir="ltr">
                      {item.clearance_fee.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700" dir="ltr">
                      {item.service_percent_070.toFixed(2)}
                    </td>
                    {result.line_items.some((li) => li.penalty_018 > 0) && (
                      <td className="px-3 py-2 text-sm font-medium text-red-600" dir="ltr">
                        {item.penalty_018 > 0 ? item.penalty_018.toFixed(2) : "—"}
                      </td>
                    )}
                    <td className="px-3 py-2 text-sm text-gray-700" dir="ltr">
                      {item.commission.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700" dir="ltr">
                      {item.discount.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-sm font-semibold text-gray-900" dir="ltr">
                      {item.total.toFixed(2)}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Shipment-level fees */}
          {result.service_flat_fee_301_total > 0 && (
            <div className="mt-3 text-right text-sm text-gray-700">
              بدل خدمات 301 (مرة واحدة لكل شحنة):{" "}
              <span dir="ltr" className="font-medium">
                {result.service_flat_fee_301_total.toFixed(2)} {result.target_currency}
              </span>
            </div>
          )}
          {result.custom_fees_total !== 0 && (
            <div className="mt-1 text-right text-sm text-gray-700">
              رسوم قواعد مخصصة:{" "}
              <span dir="ltr" className="font-medium">
                {result.custom_fees_total.toFixed(2)} {result.target_currency}
              </span>
            </div>
          )}

          {/* Early Payment Discount */}
          {result.early_payment_discount > 0 && (
            <div className="mt-3 text-right text-sm text-green-700">
              خصم الدفع المبكر:{" "}
              <span dir="ltr" className="font-medium">
                -{result.early_payment_discount.toFixed(2)} {result.target_currency}
              </span>
            </div>
          )}

          {/* Custom Rules Applied */}
          {result.custom_rules_applied && result.custom_rules_applied.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-700">
                قواعد التسعير المخصصة المطبقة
              </h3>
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

          {/* Rules Applied */}
          {result.rules_applied && result.rules_applied.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-700">
                القواعد المطبقة
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.rules_applied.map((rule, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700"
                  >
                    {rule}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex items-center gap-4 border-t border-gray-100 pt-6">
            <button
              onClick={() => navigate(ROUTES.RFQ.DETAIL(selectedRfqId))}
              className="btn-secondary"
            >
              عرض طلب عرض السعر
            </button>
            <button
              onClick={() => createQuoteMutation.mutate()}
              disabled={createQuoteMutation.isPending}
              className="btn-primary"
            >
              {createQuoteMutation.isPending
                ? "جاري الإنشاء..."
                : "📄 إنشاء عرض سعر"}
            </button>
          </div>
        </div>
      )}

      {/* No RFQ selected placeholder */}
      {!selectedRfqId && (
        <div className="card p-12 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto h-12 w-12 text-gray-300"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-600">
            حاسبة التسعير
          </h3>
          <p className="mt-2 text-sm text-gray-400">
            يرجى اختيار طلب عرض سعر للبدء في حساب التكلفة النهائية للاستيراد
          </p>
        </div>
      )}
    </div>
  );
}
