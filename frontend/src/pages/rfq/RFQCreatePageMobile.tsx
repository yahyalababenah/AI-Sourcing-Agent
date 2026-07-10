import { GlossaryTerm } from "@/components/ui/GlossaryTerm";
import { ROUTES } from "@/constants/routes";
import { useClientRfqCreate, CURRENCIES } from "./useClientRfqCreate";
import { RFQEstimatePreview } from "./RFQEstimatePreview";

// Same structured form/logic as RFQCreatePageDesktop (via useClientRfqCreate)
// stacked into a single column: form fields, then the estimate preview,
// then the submit/cancel buttons. TopBar/BottomNav/Drawer come from
// ClientLayout.
export function RFQCreatePageMobile() {
  const {
    productName,
    setProductName,
    specifications,
    setSpecifications,
    quantity,
    setQuantity,
    targetPriceCny,
    setTargetPriceCny,
    destinationPort,
    setDestinationPort,
    targetCurrency,
    setTargetCurrency,
    images,
    handleImagesChange,
    handleRemoveImage,
    estimate,
    error,
    handleSubmit,
    isPending,
    navigate,
  } = useClientRfqCreate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900"><GlossaryTerm term="RFQ">طلب عرض سعر</GlossaryTerm> جديد</h1>
        <p className="mt-1 text-sm text-slate-500">
          صف المنتج الذي تريد استيراده وسيصلك عرض سعر حقيقي من المندوب
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="card space-y-4 p-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              اسم المنتج <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              data-tour="tour-rfq-product-name"
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm transition-colors duration-150 focus:border-importer-500 focus:outline-none focus:ring-1 focus:ring-importer-500"
              placeholder="كشافات إضاءة LED صناعية"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">المواصفات</label>
            <textarea
              value={specifications}
              onChange={(e) => setSpecifications(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm transition-colors duration-150 focus:border-importer-500 focus:outline-none focus:ring-1 focus:ring-importer-500"
              placeholder="القدرة، درجة الإضاءة، مادة الجسم، معايير السلامة المطلوبة..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              <GlossaryTerm term="Quantity">الكمية</GlossaryTerm> <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              data-tour="tour-rfq-quantity"
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm transition-colors duration-150 focus:border-importer-500 focus:outline-none focus:ring-1 focus:ring-importer-500"
              placeholder="500"
              dir="ltr"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              السعر المستهدف للوحدة (<GlossaryTerm term="CNY">يوان صيني</GlossaryTerm>)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={targetPriceCny}
              onChange={(e) => setTargetPriceCny(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm transition-colors duration-150 focus:border-importer-500 focus:outline-none focus:ring-1 focus:ring-importer-500"
              placeholder="35"
              dir="ltr"
            />
            <p className="mt-1 text-xs text-slate-400">اختياري — يفعّل معاينة التكلفة التقديرية أدناه</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700"><GlossaryTerm term="Destination Port">ميناء الوصول</GlossaryTerm></label>
            <input
              type="text"
              value={destinationPort}
              onChange={(e) => setDestinationPort(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm transition-colors duration-150 focus:border-importer-500 focus:outline-none focus:ring-1 focus:ring-importer-500"
              placeholder="ميناء العقبة، الأردن"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700"><GlossaryTerm term="Target Currency">العملة المستهدفة</GlossaryTerm></label>
            <select
              value={targetCurrency}
              onChange={(e) => setTargetCurrency(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm transition-colors duration-150 focus:border-importer-500 focus:outline-none focus:ring-1 focus:ring-importer-500"
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">صور المنتج (اختياري)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleImagesChange(e.target.files)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 file:ms-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700"
            />
            {images.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {images.map((file, i) => (
                  <span
                    key={`${file.name}-${i}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
                  >
                    {file.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(i)}
                      className="text-slate-400 transition-colors duration-150 hover:text-slate-700"
                      aria-label={`إزالة ${file.name}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="mt-1.5 text-xs text-amber-600">
              ⚠️ رفع الصور غير متاح بعد بالخادم — الصور المختارة تُعرض هنا فقط ولا تُرسل مع الطلب حالياً.
            </p>
          </div>
        </div>

        <RFQEstimatePreview estimate={estimate} />

        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            data-tour="tour-rfq-submit"
            className="flex-1 rounded-lg bg-importer-500 px-4 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-importer-600 active:scale-[0.98] disabled:opacity-50"
          >
            {isPending ? "جاري الإرسال..." : "إرسال طلب عرض السعر"}
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTES.RFQ.LIST)}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-50 active:scale-[0.98]"
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
