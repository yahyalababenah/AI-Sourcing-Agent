import { useRef, type TouchEvent } from "react";
import { Video, ChevronUp, ChevronDown, AlertCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useClientReelsData } from "./useClientReelsData";
import { useClientReelsPlayer } from "./useClientReelsPlayer";
import { ClientReelPlayer } from "./ClientReelPlayer";

// Full-screen vertical player for the consumer reels feed, matching the
// supplier mobile player's visual language (ReelsStudioPageMobile) from the
// consumption side per CLAUDE.md. No video backend exists yet, so this
// surfaces real marketplace catalog products one at a time — same honest
// stance as the supplier studio, no fabricated engagement numbers.
// TopBar/BottomNav/Drawer come from ClientLayout, untouched here.
export function ClientReelsPageMobile() {
  const { products, isLoading, isError, refetch } = useClientReelsData();
  const {
    index,
    product,
    goNext,
    goPrev,
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

  if (isError) {
    return (
      <div className="card flex flex-col items-center gap-3 p-8 text-center">
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
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
        <Video className="h-4 w-4 shrink-0" />
        رفع الفيديو غير متاح بعد — هذا العرض يستخدم منتجات حقيقية من السوق العالمي
      </div>

      <div
        className="relative h-[min(75vh,640px)] w-full overflow-hidden rounded-2xl"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
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
