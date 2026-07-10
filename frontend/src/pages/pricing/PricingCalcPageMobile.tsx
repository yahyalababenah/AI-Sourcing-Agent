import { ROUTES } from "@/constants/routes";
import { EmptyState } from "@/components/ui/EmptyState";
import { GlossaryTerm } from "@/components/ui/GlossaryTerm";
import { Calculator } from "lucide-react";
import { usePricingCalculator, CURRENCIES } from "./usePricingCalculator";
import { ProductsInputTable } from "./ProductsInputTable";
import { PricingResultCard } from "./PricingResultCard";
import { PricingDetailBreakdown } from "./PricingDetailBreakdown";

// Mobile layout matches pricing-calculator-mobile.html: shipment form, then
// products, then the result card stacked underneath (no sticky side column —
// TopBar/BottomNav/Drawer come from AgentLayout). Same real RFQ-driven engine
// as PricingCalcPageDesktop via the shared usePricingCalculator hook.
export function PricingCalcPageMobile() {
  const {
    selectedRfqId,
    targetCurrency,
    setTargetCurrency,
    destinationPort,
    setDestinationPort,
    productInputs,
    setProductInputs,
    result,
    error,
    rfqsData,
    rfqsLoading,
    products,
    productsLoading,
    handleRfqChange,
    calculateMutation,
    createQuoteMutation,
    selectedRfq,
    hasProducts,
    navigate,
  } = usePricingCalculator();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">حاسبة التسعير</h1>
        <p className="mt-1 text-sm text-slate-500">
          حساب التكلفة النهائية لاستيراد المنتجات مع تطبيق قواعد التسعير
        </p>
      </div>

      <div className="card p-4">
        <h2 className="mb-4 text-base font-semibold text-slate-900">بيانات الشحنة</h2>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700"><GlossaryTerm term="RFQ">طلب عرض السعر</GlossaryTerm></label>
            {rfqsLoading ? (
              <div className="flex h-10 items-center text-sm text-slate-400">جاري التحميل...</div>
            ) : (
              <select
                value={selectedRfqId}
                onChange={(e) => handleRfqChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm transition-colors duration-150 focus:border-supplier-500 focus:outline-none"
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
            <label className="mb-1 block text-sm font-medium text-slate-700">العملة المستهدفة</label>
            <select
              value={targetCurrency}
              onChange={(e) => setTargetCurrency(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm transition-colors duration-150 focus:border-supplier-500 focus:outline-none"
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm transition-colors duration-150 focus:border-supplier-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {selectedRfqId && (
        <div className="card p-4">
          <h2 className="mb-4 text-base font-semibold text-slate-900">تعديل المنتجات</h2>

          {productsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-supplier-100 border-t-supplier-600" />
            </div>
          ) : !hasProducts ? (
            <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
              {selectedRfq
                ? `لا توجد منتجات مستخرجة لطلب عرض السعر "${selectedRfq.client_name}". يرجى تحميل مستند أولاً.`
                : "لم يتم العثور على منتجات"}
            </div>
          ) : (
            <>
              <ProductsInputTable
                products={products ?? []}
                productInputs={productInputs}
                setProductInputs={setProductInputs}
              />

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
            </>
          )}

          {error && <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        </div>
      )}

      {result ? (
        <PricingResultCard
          result={result}
          onViewRfq={() => navigate(ROUTES.RFQ.DETAIL(selectedRfqId))}
          onCreateQuote={() => createQuoteMutation.mutate()}
          isCreatingQuote={createQuoteMutation.isPending}
        />
      ) : (
        <EmptyState
          icon={Calculator}
          title="حاسبة التسعير"
          description={
            selectedRfqId
              ? "أدخل بيانات المنتجات ثم اضغط \"حساب التسعير\" لعرض التكلفة الواصلة"
              : "يرجى اختيار طلب عرض سعر للبدء في حساب التكلفة النهائية للاستيراد"
          }
        />
      )}

      {result && <PricingDetailBreakdown result={result} productInputs={productInputs} />}
    </div>
  );
}
