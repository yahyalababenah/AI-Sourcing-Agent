import { useRef, type TouchEvent } from "react";
import { Video, ChevronUp, ChevronDown } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useReelsStudioData } from "./useReelsStudioData";
import { useReelsPlayer } from "./useReelsPlayer";
import { ReelPlayer } from "./ReelPlayer";

// Full-screen vertical player matching supplier-reels-mobile.html. No video
// backend exists yet (see the amber notice below), so this surfaces the
// supplier's real catalog products one at a time — same honest rfqCount=0
// approach as ReelsStudioPageDesktop, not fabricated engagement numbers.
// TopBar/BottomNav/Drawer come from AgentLayout, untouched here.
export function ReelsStudioPageMobile() {
  const { products, isLoading, factoryName, isVerified } = useReelsStudioData();
  const {
    index,
    product,
    goNext,
    goPrev,
    hasNext,
    hasPrev,
    saved,
    toggleSave,
    handleShare,
    handleAsk,
    handleUpload,
    handleRequestQuote,
  } = useReelsPlayer(products);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStartY.current == null) return;
    const delta = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(delta) > 40) (delta > 0 ? goNext : goPrev)();
    touchStartY.current = null;
  };

  if (isLoading) {
    return <div className="h-[70vh] animate-pulse rounded-2xl bg-slate-100" />;
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
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
        <Video className="h-4 w-4 shrink-0" />
        رفع الفيديو غير متاح بعد — هذا العرض يستخدم منتجاتك الحقيقية من الكتالوج
      </div>

      <div
        className="relative h-[min(75vh,640px)] w-full overflow-hidden rounded-2xl"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
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

        <button
          onClick={goPrev}
          disabled={!hasPrev}
          aria-label="اللقطة السابقة"
          className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-black/20 p-1.5 text-white/80 transition-opacity duration-150 disabled:opacity-30"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          onClick={goNext}
          disabled={!hasNext}
          aria-label="اللقطة التالية"
          className="absolute left-1/2 bottom-2 -translate-x-1/2 rounded-full bg-black/20 p-1.5 text-white/80 transition-opacity duration-150 disabled:opacity-30"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
