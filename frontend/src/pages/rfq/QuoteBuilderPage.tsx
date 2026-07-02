import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { ArrowRight, Calculator, Send, AlertCircle, CheckCircle, Loader2, Package, X, Search } from "lucide-react";
import { intakeService } from "@/services/intakeService";
import { pricingService } from "@/services/pricingService";
import { quotationService } from "@/services/quotationService";
import { catalogService } from "@/services/catalogService";
import { ROUTES } from "@/constants/routes";
import type { CalculatePriceResponse } from "@/types/pricing";
import type { CatalogProduct } from "@/types/catalog";
import type { Product } from "@/types/intake";

function extractApiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const backendMessage = err.response?.data?.error?.message;
    if (typeof backendMessage === "string") return backendMessage;
  }
  return err instanceof Error ? err.message : fallback;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(n: number, currency = "JOD") {
  return `${n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function extractPricingInput(
  rfq: { extracted_entities?: Record<string, unknown>; target_currency?: string; destination_port?: string },
  products?: Product[]
) {
  const ent = rfq.extracted_entities ?? {};
  // Quantity and product name have a real, structured source of truth — the
  // RFQ's Product row(s) (same data RFQDetailPage/RFQListPage/the dashboard
  // show) — which must win over the AI-extraction JSONB blob whenever it
  // exists. Previously this always read from `extracted_entities` alone, so
  // any RFQ whose product was added via the normal "add product" flow
  // (never ran through AI translation) silently priced quantity=1 with a
  // generic "منتج" name instead of the real quantity/name — a demo-visible
  // and production-real bug (e.g. an 8-unit order priced as 1 unit).
  // Unit price has no such structured source (Product.target_price is the
  // client's budget guess in the target currency, not a CNY supplier price),
  // so it still only comes from extraction, with the existing manual-entry
  // fallback UI handling the common case where it's missing.
  const firstProduct = products?.[0];
  const unitPrice = parseFloat(String(ent.unit_price_rmb ?? ent.unit_price ?? ent.price ?? 0));
  const quantity = firstProduct?.quantity ?? parseInt(String(ent.quantity ?? 1), 10);
  const productName = firstProduct?.name ?? String(ent.product_name ?? ent.name ?? "منتج");
  const modelNumber = ent.model_number ? String(ent.model_number) : undefined;
  return { unitPrice, quantity, productName, modelNumber };
}

// ─── Section card ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-base font-semibold text-gray-900">{title}</h2>
      {children}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function QuoteBuilderPage() {
  const { id: rfqId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // ── Agent inputs ─────────────────────────────────────────────────────────
  const [freightInput, setFreightInput]     = useState("");
  const [manualUnitPrice, setManualUnitPrice] = useState("");
  const [notes, setNotes]                   = useState("");
  const [paymentTerms, setPaymentTerms]     = useState("T/T — 30% مقدماً، 70% عند الشحن");
  const [deliveryTerms, setDeliveryTerms]   = useState("FOB Shenzhen");
  const [validityDays, setValidityDays]     = useState(30);
  const [submitError, setSubmitError]       = useState<string | null>(null);
  const [catalogQuery, setCatalogQuery]     = useState("");
  const [selectedCatalogProduct, setSelectedCatalogProduct] = useState<CatalogProduct | null>(null);

  // ── Load RFQ ─────────────────────────────────────────────────────────────
  const { data: rfq, isLoading: rfqLoading } = useQuery({
    queryKey: ["rfq", rfqId],
    queryFn: () => intakeService.get(rfqId!),
    enabled: !!rfqId,
  });

  // ── Load the RFQ's real product(s) — the structured source of truth for
  //    quantity/name, overriding the AI-extraction-only fallback below ──
  const { data: products } = useQuery({
    queryKey: ["rfq-products", rfqId],
    queryFn: () => intakeService.listProducts(rfqId!),
    enabled: !!rfqId,
  });

  // ── Derive pricing inputs from RFQ ────────────────────────────────────────
  const pi = useMemo(() => (rfq ? extractPricingInput(rfq, products) : null), [rfq, products]);

  // ── Catalog product search (optional link for MOQ enforcement) ───────────
  const { data: catalogResults, isFetching: catalogSearching } = useQuery({
    queryKey: ["catalog-search", catalogQuery],
    queryFn: () => catalogService.search({ q: catalogQuery, page_size: 8 }),
    enabled: catalogQuery.trim().length >= 2,
  });

  const moqViolation = useMemo(() => {
    if (!selectedCatalogProduct?.moq || !pi) return null;
    if (pi.quantity < selectedCatalogProduct.moq) {
      return `الكمية المطلوبة (${pi.quantity.toLocaleString()}) أقل من الحد الأدنى للطلب لدى المورد (MOQ: ${selectedCatalogProduct.moq.toLocaleString()})`;
    }
    return null;
  }, [selectedCatalogProduct, pi]);

  // Effective unit price: manual input wins, else extracted from RFQ
  const effectiveUnitPrice = useMemo(() => {
    const manual = manualUnitPrice !== "" ? parseFloat(manualUnitPrice) || 0 : 0;
    return manual > 0 ? manual : (pi?.unitPrice ?? 0);
  }, [manualUnitPrice, pi]);

  const hasEffectivePrice = effectiveUnitPrice > 0;

  // ── Auto-calculate pricing ────────────────────────────────────────────────
  const { data: calc, isLoading: calcLoading, isError: calcError } = useQuery<CalculatePriceResponse>({
    queryKey: ["pricing-calc", rfqId, effectiveUnitPrice, pi?.quantity],
    queryFn: () =>
      pricingService.calculate({
        rfq_id: rfqId!,
        target_currency: rfq?.target_currency ?? "JOD",
        destination_port: rfq?.destination_port ?? "Aqaba",
        products: [
          {
            product_id: rfqId!,
            name: pi!.productName,
            quantity: pi!.quantity,
            unit_price_cny: effectiveUnitPrice,
          },
        ],
      }),
    enabled: !!pi && effectiveUnitPrice > 0,
    retry: false,
  });

  // ── Compute freight & grand total ─────────────────────────────────────────
  const autoFreight  = useMemo(
    () => calc?.line_items?.reduce((s, l) => s + l.freight_cost, 0) ?? 0,
    [calc]
  );
  const agentFreight = freightInput !== "" ? parseFloat(freightInput) : autoFreight;
  const freightDiff  = agentFreight - autoFreight;
  const grandTotal   = calc ? calc.grand_total + freightDiff : 0;

  // ── Build quotation payload ───────────────────────────────────────────────
  function buildPayload() {
    if (!calc || !rfq) throw new Error("بيانات الحساب غير مكتملة");
    const currency = calc.target_currency;
    const rate = calc.exchange_rate_used;

    // `l.product_id` here is whatever was sent to /pricing/calculate as a
    // passthrough identifier — this page always sends the RFQ's own id
    // (harmless there, since /pricing/calculate never validates it against
    // anything). Using that same value as the quotation line item's
    // product_id is NOT harmless: it's a real FK to `products`, and an RFQ's
    // id is never a valid Product id, so every "send quote" submission
    // crashed the backend with a FK violation (verified via direct repro:
    // POST /quotes/generate → 500, ForeignKeyViolationError on
    // quotation_line_items_product_id_fkey). Use the RFQ's real Product row
    // when one exists (the same one whose quantity/name already power this
    // page after the F9 fix); otherwise omit it — the column is nullable.
    const realProductId = products?.[0]?.id;
    const lineItems = calc.line_items.map((l) => ({
      product_id:         realProductId,
      catalog_product_id: selectedCatalogProduct?.id,
      product_name:       l.product_name,
      quantity:           l.quantity,
      unit_price_cny:     l.unit_price_cny,
      unit_price_converted: l.unit_price_converted,
      exchange_rate:      l.exchange_rate,
      freight_cost:       agentFreight / calc.line_items.length,
      customs_duty:       l.customs_duty,
      commission:         l.commission,
      subtotal:           l.subtotal + freightDiff / calc.line_items.length,
      discount:           l.discount,
      total:              l.total + freightDiff / calc.line_items.length,
    }));

    return {
      rfq_id:            rfqId!,
      target_currency:   currency,
      exchange_rate_used: rate,
      line_items:        lineItems,
      subtotal:          calc.subtotal_before_vat,
      freight_total:     agentFreight,
      customs_total:     calc.line_items.reduce((s, l) => s + l.customs_duty, 0),
      commission_total:  calc.line_items.reduce((s, l) => s + l.commission, 0),
      discount_total:    calc.discount_total,
      vat_total:         calc.vat,
      grand_total:       grandTotal,
      payment_terms:     paymentTerms || undefined,
      delivery_terms:    deliveryTerms || undefined,
      validity_days:     validityDays,
      notes:             notes || undefined,
    };
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: () => quotationService.generate(buildPayload() as Parameters<typeof quotationService.generate>[0]),
    onSuccess: (res) => {
      navigate(ROUTES.QUOTES.DETAIL(res.quotation_id ?? res.task_id));
    },
    onError: (err: Error) => setSubmitError(extractApiErrorMessage(err, "تعذّر إرسال عرض السعر")),
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (rfqLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-400" />
      </div>
    );
  }

  if (!rfq) {
    return (
      <div className="card p-12 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
        <p className="mt-3 text-sm text-red-600">لم يتم العثور على الطلب</p>
      </div>
    );
  }

  const currency = rfq.target_currency ?? "JOD";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(ROUTES.RFQ.DETAIL(rfqId!))}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          <ArrowRight className="inline h-4 w-4 ml-1" />
          الطلب
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إرسال عرض السعر</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            العميل: <span className="font-medium text-gray-800">{rfq.client_name ?? "—"}</span>
            {rfq.destination_port && (
              <span className="mr-3 text-gray-400">الميناء: {rfq.destination_port}</span>
            )}
          </p>
        </div>
      </div>

      {/* ── Client Request ── */}
      <Section title="طلب العميل">
        <p className="text-sm text-gray-700 leading-relaxed">
          {rfq.client_request_arabic ?? "—"}
        </p>
        {pi && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
              المنتج: {pi.productName}
            </span>
            {pi.modelNumber && (
              <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600" dir="ltr">
                {pi.modelNumber}
              </span>
            )}
            <span className="rounded-full bg-green-50 px-3 py-1 text-green-700">
              الكمية: {pi.quantity.toLocaleString()} وحدة
            </span>
            {pi.unitPrice > 0 && (
              <span className="rounded-full bg-orange-50 px-3 py-1 text-orange-700">
                السعر الأساسي: {pi.unitPrice} CNY
              </span>
            )}
          </div>
        )}
      </Section>

      {/* ── Catalog Product Link (optional, enforces supplier MOQ) ── */}
      <Section title="ربط بمنتج من كتالوج المورد (اختياري)">
        {selectedCatalogProduct ? (
          <div className="flex items-center justify-between rounded-lg border border-primary-200 bg-primary-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-primary-600" />
              <span className="font-medium text-gray-800">{selectedCatalogProduct.product_name}</span>
              {selectedCatalogProduct.moq && (
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-600">
                  MOQ: {selectedCatalogProduct.moq.toLocaleString()}
                </span>
              )}
            </div>
            <button
              onClick={() => setSelectedCatalogProduct(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div>
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                placeholder="ابحث باسم المنتج لربطه بمنتج مورد محدد..."
                className="w-full rounded-lg border border-gray-300 py-2.5 pr-9 pl-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            {catalogSearching && (
              <p className="mt-2 text-xs text-gray-400">جاري البحث...</p>
            )}
            {catalogResults && catalogResults.items.length > 0 && (
              <div className="mt-2 max-h-56 divide-y divide-gray-50 overflow-y-auto rounded-lg border border-gray-100">
                {catalogResults.items.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedCatalogProduct(p); setCatalogQuery(""); }}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-right text-sm hover:bg-gray-50"
                  >
                    <span className="font-medium text-gray-800">{p.product_name}</span>
                    <span className="flex items-center gap-2 text-xs text-gray-500">
                      {p.supplier_name && <span>{p.supplier_name}</span>}
                      {p.moq && <span className="rounded-full bg-gray-100 px-2 py-0.5">MOQ: {p.moq.toLocaleString()}</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {catalogResults && catalogQuery.trim().length >= 2 && catalogResults.items.length === 0 && !catalogSearching && (
              <p className="mt-2 text-xs text-gray-400">لا توجد نتائج مطابقة</p>
            )}
            <p className="mt-1.5 text-xs text-gray-400">
              اربط هذا العرض بمنتج محدد من كتالوج المورد ليتحقق النظام تلقائياً من الحد الأدنى للطلب (MOQ)
            </p>
          </div>
        )}
        {moqViolation && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {moqViolation}
          </div>
        )}
      </Section>

      {/* ── Pricing Breakdown ── */}
      <Section title="تفاصيل التكلفة">
        {!hasEffectivePrice && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
            <AlertCircle className="inline h-4 w-4 ml-1" />
            لم يستخرج النظام سعر الوحدة من هذا الطلب. أدخل <strong>سعر الوحدة بالريال الصيني (CNY)</strong> في حقل "السعر اليدوي" أدناه لتمكين حساب التكلفة.
          </div>
        )}

        {hasEffectivePrice && calcLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            جاري حساب التكلفة...
          </div>
        )}

        {hasEffectivePrice && calcError && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
            <AlertCircle className="inline h-4 w-4 ml-1" />
            تعذّر حساب التكلفة تلقائياً. تحقق من قواعد التسعير أو أدخل القيم يدوياً.
          </div>
        )}

        {calc && (
          <div className="overflow-hidden rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-right">البند</th>
                  <th className="px-4 py-2 text-right">الكمية</th>
                  <th className="px-4 py-2 text-right">سعر الوحدة</th>
                  <th className="px-4 py-2 text-right">الجمارك</th>
                  <th className="px-4 py-2 text-right">العمولة</th>
                  <th className="px-4 py-2 text-right">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {calc.line_items.map((l, i) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-800">{l.product_name}</td>
                    <td className="px-4 py-3 text-gray-600">{l.quantity.toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-600" dir="ltr">
                      {fmt(l.unit_price_converted, currency)}
                    </td>
                    <td className="px-4 py-3 text-gray-600" dir="ltr">
                      {fmt(l.customs_duty, currency)}
                    </td>
                    <td className="px-4 py-3 text-gray-600" dir="ltr">
                      {fmt(l.commission, currency)}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800" dir="ltr">
                      {fmt(l.total, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals — each row below must sum exactly to "الإجمالي الكلي".
                Previously: "بدون شحن" (without shipping) showed
                calc.subtotal_before_vat, which the backend actually computes
                WITH the auto-freight already folded in (see
                engine.py's total_per_unit) — so the label lied. VAT was also
                inflated by `freightDiff * 0.16` to "explain" the total, even
                though the pricing engine explicitly excludes freight from
                the VAT base (see the F6 fix) — meaning the number shown here
                during editing didn't match `vat_total` actually saved on the
                quotation via buildPayload() below (which correctly uses the
                unmodified calc.vat). The discount line was missing entirely,
                so the three visible rows never added up to the grand total
                on-screen even before an override. Fixed: subtract autoFreight
                from the subtotal so the label is literally true, keep VAT as
                the real backend value, and show the discount explicitly. */}
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>المجموع (بدون شحن وضريبة)</span>
                <span dir="ltr">{fmt(calc.subtotal_before_vat - autoFreight, currency)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>
                  الشحن
                  {autoFreight > 0 && (
                    <span className="mr-1 text-xs text-gray-400">(تلقائي: {fmt(autoFreight, currency)})</span>
                  )}
                </span>
                <span dir="ltr">{fmt(agentFreight, currency)}</span>
              </div>
              {calc.discount_total > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>الخصم (دفع مبكر / كمية)</span>
                  <span dir="ltr">-{fmt(calc.discount_total, currency)}</span>
                </div>
              )}
              {calc.vat > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>ضريبة القيمة المضافة</span>
                  <span dir="ltr">{fmt(calc.vat, currency)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
                <span>الإجمالي الكلي</span>
                <span dir="ltr" className="text-primary-700">{fmt(grandTotal, currency)}</span>
              </div>
              <p className="text-xs text-gray-400">
                سعر الصرف: 1 CNY = {calc.exchange_rate_used.toFixed(4)} {currency}
              </p>
            </div>
          </div>
        )}
      </Section>

      {/* ── Agent Inputs ── */}
      <Section title="تفاصيل العرض">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Manual unit price — shown when no extracted price */}
          {!(pi && pi.unitPrice > 0) && (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-amber-700">
                سعر الوحدة (CNY) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={manualUnitPrice}
                onChange={(e) => setManualUnitPrice(e.target.value)}
                placeholder="مثال: 45.00"
                className="w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                dir="ltr"
              />
              <p className="mt-1 text-xs text-amber-600">
                سعر الوحدة الأصلي بالريال الصيني — مطلوب لحساب التكلفة الإجمالية
              </p>
            </div>
          )}

          {/* Freight override */}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              تكلفة الشحن الفعلية ({currency})
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={0.01}
                value={freightInput}
                onChange={(e) => setFreightInput(e.target.value)}
                placeholder={autoFreight > 0 ? `${autoFreight.toFixed(2)} (محسوب تلقائياً)` : "أدخل تكلفة الشحن"}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              {freightInput !== "" && (
                <button
                  onClick={() => setFreightInput("")}
                  className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap"
                >
                  إعادة تعيين
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              اتركه فارغاً لاستخدام الشحن المحسوب تلقائياً من قواعد التسعير
            </p>
          </div>

          {/* Payment Terms */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">شروط الدفع</label>
            <input
              type="text"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* Delivery Terms */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">شروط التسليم</label>
            <input
              type="text"
              value={deliveryTerms}
              onChange={(e) => setDeliveryTerms(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* Validity */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">مدة صلاحية العرض (يوم)</label>
            <input
              type="number"
              min={1}
              max={365}
              value={validityDays}
              onChange={(e) => setValidityDays(Math.max(1, Number(e.target.value)))}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          {/* Notes */}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">ملاحظات إضافية</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي تفاصيل إضافية للعميل..."
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
            />
          </div>
        </div>
      </Section>

      {/* ── Summary + Submit ── */}
      <div className="rounded-xl border border-primary-200 bg-primary-50 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary-800">
            <Calculator className="h-5 w-5" />
            <span className="font-semibold">إجمالي عرض السعر</span>
          </div>
          <span className="text-2xl font-bold text-primary-700" dir="ltr">
            {calc ? fmt(grandTotal, currency) : "—"}
          </span>
        </div>

        {submitError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {submitError}
          </div>
        )}

        {sendMutation.isSuccess && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            <CheckCircle className="h-4 w-4 shrink-0" />
            تم إرسال العرض وجاري توليد PDF…
          </div>
        )}

        <button
          onClick={() => { setSubmitError(null); sendMutation.mutate(); }}
          disabled={sendMutation.isPending || sendMutation.isSuccess || !hasEffectivePrice || (hasEffectivePrice && !calc) || !!moqViolation}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
        >
          {sendMutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> جاري الإرسال...</>
          ) : (
            <><Send className="h-4 w-4" /> إرسال عرض السعر للعميل</>
          )}
        </button>
        <p className="mt-2 text-center text-xs text-primary-600">
          سيتم توليد PDF تلقائياً وإرساله للعميل
        </p>
      </div>
    </div>
  );
}
