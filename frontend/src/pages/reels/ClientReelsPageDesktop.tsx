import { Video, ChevronUp, ChevronDown, ShieldCheck, AlertCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useClientReelsData } from "./useClientReelsData";
import { useClientReelsPlayer } from "./useClientReelsPlayer";
import { ClientReelPlayer } from "./ClientReelPlayer";

const formatPrice = (price: number | null) => (price == null ? "—" : `¥${price.toLocaleString()}`);

// Distinct color per row so clips without cover media still read apart —
// same rotation the supplier studio list uses.
const TINTS = ["bg-importer-600", "bg-sky-600", "bg-amber-600", "bg-importer-400", "bg-slate-500"];

// Consumer reels feed, desktop: 300px sticky player + a browsable "لقطات
// أخرى" list, mirroring ReelsStudioPageDesktop's layout from the consumption
// side. No performance panel and no upload button here — those are
// supplier-only (per CLAUDE.md, "بلا لوحة أداء ولا زر رفع" for the consumer
// player). Shares useClientReelsData/useClientReelsPlayer/ClientReelPlayer
// with ClientReelsPageMobile so neither file duplicates fetch/nav logic.
export function ClientReelsPageDesktop() {
  const { products, isLoading, isError, refetch } = useClientReelsData();
  const {
    index,
    product,
    goNext,
    goPrev,
    selectIndex,
    hasNext,
    hasPrev,
    isShortlisted,
    toggleShortlist,
    isFollowingFactory,
    toggleFollowFactory,
    handleShare,
    handleAsk,
    handleRequestQuote,
  } = useClientReelsPlayer(products);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        <div className="h-[420px] animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card flex flex-col items-center gap-3 p-12 text-center">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-sm text-red-600">تعذّر تحميل اللقطات. حاول مرة أخرى.</p>
        <button
          onClick={() => refetch()}
          className="rounded-lg border border-red-300 px-4 py-1.5 text-xs font-medium text-red-700 transition-colors duration-150 hover:bg-red-50"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <EmptyState
        icon={Video}
        title="لا توجد لقطات بعد"
        description="لم ينشر أي مصنع منتجات بعد — عد لاحقاً"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ريلز</h1>
        <p className="mt-1 text-sm text-slate-500">اكتشف لقطات المصانع واطلب عرض سعر مباشرة</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-3 lg:sticky lg:top-6 lg:h-fit">
          <div className="relative h-[420px] w-full overflow-hidden rounded-2xl">
            <ClientReelPlayer
              product={product}
              index={index}
              total={products.length}
              isShortlisted={isShortlisted}
              onToggleShortlist={toggleShortlist}
              isFollowingFactory={isFollowingFactory}
              onToggleFollowFactory={toggleFollowFactory}
              onAsk={handleAsk}
              onShare={handleShare}
              onRequestQuote={handleRequestQuote}
              className="absolute inset-0"
            />
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={goPrev}
              disabled={!hasPrev}
              aria-label="اللقطة السابقة"
              className="rounded-full border border-slate-200 p-1.5 text-slate-500 transition-colors duration-150 hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              onClick={goNext}
              disabled={!hasNext}
              aria-label="اللقطة التالية"
              className="rounded-full border border-slate-200 p-1.5 text-slate-500 transition-colors duration-150 hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-slate-900">
              {product.factory_name ?? product.supplier_name ?? "مصنع غير مسمّى"}
            </h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-importer-400" />
              كل حساب مصنع في المنصة يمثّل عملاً حقيقياً موثّقاً عبر الأدمن
            </p>
          </div>

          <div className="card p-6">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">لقطات أخرى</h2>
            <div className="space-y-2">
              {products.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => selectIndex(i)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-start transition-colors duration-150 ${
                    i === index ? "border-importer-200 bg-importer-50" : "border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  <span className={`h-10 w-10 shrink-0 rounded-lg ${TINTS[i % TINTS.length]}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {p.product_name ?? "منتج بدون اسم"}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {p.factory_name ?? p.supplier_name ?? "مصنع غير مسمّى"}
                    </span>
                  </span>
                  <span className="shrink-0 text-end text-xs font-medium tabular-nums text-slate-900" dir="ltr">
                    {formatPrice(p.unit_price_rmb)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
