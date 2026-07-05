import { useRef, useState, type TouchEvent } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Plus, Video, Bookmark, MessageCircle, Share2, ChevronUp, ChevronDown, ShieldCheck } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { EmptyState } from "@/components/ui/EmptyState";
import { useReelsStudioData } from "./useReelsStudioData";

const formatPrice = (price: number | null) => (price == null ? "—" : `¥${price.toLocaleString()}`);

function initialsOf(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

interface SideButtonProps {
  icon: typeof Bookmark;
  label: string;
  active?: boolean;
  onClick: () => void;
}

function SideButton({ icon: Icon, label, active, onClick }: SideButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 text-white transition-transform duration-150 active:scale-[0.98]"
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-150 ${
          active ? "bg-white text-supplier-600" : "bg-white/15 text-white"
        }`}
      >
        <Icon className="h-4 w-4" fill={active ? "currentColor" : "none"} />
      </span>
      <span className="text-[10px] text-white/90">{label}</span>
    </button>
  );
}

// Full-screen vertical player matching supplier-reels-mobile.html. No video
// backend exists yet (see the amber notice below), so this surfaces the
// supplier's real catalog products one at a time — same honest rfqCount=0
// approach as ReelsStudioPageDesktop's tile grid, not fabricated engagement
// numbers. TopBar/BottomNav/Drawer come from AgentLayout, untouched here.
export function ReelsStudioPageMobile() {
  const navigate = useNavigate();
  const { products, isLoading, factoryName, isVerified } = useReelsStudioData();
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const touchStartY = useRef<number | null>(null);

  const product = products[index];

  const goNext = () => setIndex((i) => Math.min(i + 1, products.length - 1));
  const goPrev = () => setIndex((i) => Math.max(i - 1, 0));

  const handleTouchStart = (e: TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStartY.current == null) return;
    const delta = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(delta) > 40) (delta > 0 ? goNext : goPrev)();
    touchStartY.current = null;
  };

  const toggleSave = () => {
    if (!product) return;
    setSaved((s) => ({ ...s, [product.id]: !s[product.id] }));
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: product?.product_name ?? "منتج", url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      toast.success("تم نسخ رابط اللقطة");
    }
  };

  const handleAsk = () => navigate(ROUTES.CHAT.LIST);
  const handleUpload = () => toast("رفع الفيديو غير متاح بعد", { icon: "🎬" });
  const handleRequestQuote = () => navigate(ROUTES.RFQ.SUPPLIER_INBOX);

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
        className="relative h-[min(75vh,640px)] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-supplier-900 to-supplier-600"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div key={product.id} className="absolute inset-0 flex animate-[totalReveal_250ms_ease-out] flex-col">
          <div className="flex items-center justify-between p-3">
            <button
              onClick={handleUpload}
              className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white transition-colors duration-150 hover:bg-white/25 active:scale-[0.98]"
            >
              <Plus className="h-3.5 w-3.5" />
              ارفع
            </button>
            <span className="text-xs text-white/70" dir="ltr">
              {index + 1} / {products.length}
            </span>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15">
              <Video className="h-7 w-7 text-white/80" />
            </div>
          </div>

          <div className="absolute end-3 top-1/2 flex -translate-y-1/2 flex-col items-center gap-4">
            <SideButton icon={Bookmark} label="حفظ" active={!!saved[product.id]} onClick={toggleSave} />
            <SideButton icon={MessageCircle} label="سؤال" onClick={handleAsk} />
            <SideButton icon={Share2} label="مشاركة" onClick={handleShare} />
          </div>

          <div className="space-y-2 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {isVerified && <ShieldCheck className="h-4 w-4 text-supplier-200" />}
                <span className="text-sm font-medium text-white">{factoryName}</span>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-semibold text-white">
                {initialsOf(factoryName)}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                onClick={handleRequestQuote}
                className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-supplier-900 transition-transform duration-150 active:scale-[0.98]"
              >
                طلب عرض سعر
              </button>
              <div className="text-end">
                <p className="text-sm font-semibold tabular-nums text-white" dir="ltr">
                  {formatPrice(product.unit_price_rmb)}
                </p>
                <p className="line-clamp-1 text-[11px] text-white/70">{product.product_name ?? "منتج بدون اسم"}</p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[11px] text-white/70">
              <span className="font-semibold text-supplier-200">0 طلب سعر</span>
              <span>مشاهدات —</span>
            </div>
          </div>
        </div>

        <button
          onClick={goPrev}
          disabled={index === 0}
          aria-label="اللقطة السابقة"
          className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-black/20 p-1.5 text-white/80 transition-opacity duration-150 disabled:opacity-30"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          onClick={goNext}
          disabled={index === products.length - 1}
          aria-label="اللقطة التالية"
          className="absolute left-1/2 bottom-2 -translate-x-1/2 rounded-full bg-black/20 p-1.5 text-white/80 transition-opacity duration-150 disabled:opacity-30"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
