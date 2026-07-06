import { Video, ChevronUp, ChevronDown, AlertCircle } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { useReelsStudioData } from "./useReelsStudioData";
import { useReelsPlayer } from "./useReelsPlayer";
import { ReelPlayer } from "./ReelPlayer";

const formatPrice = (price: number | null) => (price == null ? "—" : `¥${price.toLocaleString()}`);

// Distinct color per row so clips without cover media still read apart —
// same rotation the old tile grid used.
const TINTS = ["bg-supplier-600", "bg-sky-600", "bg-amber-600", "bg-supplier-400", "bg-slate-500"];

// Real 300px sticky player + "كل اللقطات" management list, matching
// supplier-reels-desktop.html. Replaces the temporary tile-grid gallery from
// T6.1. Shares useReelsStudioData/useReelsPlayer/ReelPlayer with
// ReelsStudioPageMobile so clip navigation and the player chrome aren't
// duplicated between the two files (T6.2.1: the old grid's local ReelTile —
// which never showed an RFQ count — is gone entirely, not just swapped).
export function ReelsStudioPageDesktop() {
  const { products, isLoading, isError, refetch, factoryName, isVerified } = useReelsStudioData();
  const {
    index,
    product,
    goNext,
    goPrev,
    selectIndex,
    hasNext,
    hasPrev,
    saved,
    toggleSave,
    handleShare,
    handleAsk,
    handleUpload,
    handleRequestQuote,
  } = useReelsPlayer(products);

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
        <p className="text-sm text-red-600">تعذّر تحميل منتجاتك. حاول مرة أخرى.</p>
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
        title="لا توجد منتجات بعد"
        description="ارفع كتالوج أو مستند منتجات لتظهر لقطاتها هنا"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">أستوديو لقطات المصنع</h1>
          <p className="mt-1 text-sm text-slate-500">
            استعرض لقطاتك وتابع أداءها التجاري — أو انشر لقطة جديدة
          </p>
        </div>
        <button
          onClick={handleUpload}
          className="rounded-lg bg-supplier-500 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-supplier-600 active:scale-[0.98]"
        >
          + ارفع لقطة جديدة
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-3 lg:sticky lg:top-6 lg:h-fit">
          <div className="relative h-[420px] w-full overflow-hidden rounded-2xl">
            <ReelPlayer
              product={product}
              index={index}
              total={products.length}
              factoryName={factoryName}
              isVerified={isVerified}
              isSaved={!!saved[product.id]}
              onToggleSave={toggleSave}
              onAsk={handleAsk}
              onShare={handleShare}
              onUpload={handleUpload}
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
            <h2 className="text-sm font-semibold text-slate-900">{product.product_name ?? "منتج بدون اسم"}</h2>
            <p className="mt-1 text-xs text-slate-500">
              المقياس الأساسي هو طلبات عروض الأسعار الناتجة، لا المشاهدات المجرّدة
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard value="0" label="طلبات سعر" />
              <StatCard value="—" label="معدل التحويل" />
              <StatCard value="0" label="حفظ" />
              <StatCard value="—" label="مشاهدات" />
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              <Video className="h-4 w-4 shrink-0" />
              رفع الفيديو وتتبّع الأداء غير متاحين بعد — الأرقام أعلاه صفر/غير متاحة حقيقةً، لا تقديرات
            </div>
          </div>

          <div className="card p-6">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">كل اللقطات</h2>
            <div className="space-y-2">
              {products.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => selectIndex(i)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-start transition-colors duration-150 ${
                    i === index ? "border-supplier-200 bg-supplier-50" : "border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  <span className="shrink-0 text-center">
                    <span className="block text-lg font-bold tabular-nums text-slate-900">0</span>
                    <span className="block text-[10px] text-slate-400">طلب سعر</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {p.product_name ?? "منتج بدون اسم"}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {formatPrice(p.unit_price_rmb)}
                      {p.moq ? ` · MOQ ${p.moq.toLocaleString()}` : ""}
                    </span>
                  </span>
                  <span className={`h-10 w-10 shrink-0 rounded-lg ${TINTS[i % TINTS.length]}`} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
