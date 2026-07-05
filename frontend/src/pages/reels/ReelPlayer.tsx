import { Plus, Video, Bookmark, MessageCircle, Share2, ShieldCheck } from "lucide-react";
import type { CatalogProduct } from "@/types/catalog";

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

interface ReelPlayerProps {
  product: CatalogProduct;
  index: number;
  total: number;
  factoryName: string;
  isVerified: boolean;
  isSaved: boolean;
  onToggleSave: () => void;
  onAsk: () => void;
  onShare: () => void;
  onUpload: () => void;
  onRequestQuote: () => void;
  /** Sizing/positioning (height, width, sticky, rounding) is owned by the
   * caller — ReelsStudioPageMobile (full-bleed) and ReelsStudioPageDesktop
   * (300px sticky column) need very different containers around this. */
  className?: string;
}

// The player's persistent commercial "chrome" — upload button, clip counter,
// side action buttons, and the bottom overlay that never disappears (per
// CLAUDE.md's reels spec) — shared between the mobile full-screen player and
// the desktop 300px sticky player so neither duplicates this markup.
export function ReelPlayer({
  product,
  index,
  total,
  factoryName,
  isVerified,
  isSaved,
  onToggleSave,
  onAsk,
  onShare,
  onUpload,
  onRequestQuote,
  className = "",
}: ReelPlayerProps) {
  return (
    <div className={`relative overflow-hidden bg-gradient-to-b from-supplier-900 to-supplier-600 ${className}`}>
      <div key={product.id} className="absolute inset-0 flex animate-[totalReveal_250ms_ease-out] flex-col">
        <div className="flex items-center justify-between p-3">
          <button
            onClick={onUpload}
            className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white transition-colors duration-150 hover:bg-white/25 active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" />
            ارفع
          </button>
          <span className="text-xs text-white/70" dir="ltr">
            {index + 1} / {total}
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15">
            <Video className="h-7 w-7 text-white/80" />
          </div>
        </div>

        <div className="absolute end-3 top-1/2 flex -translate-y-1/2 flex-col items-center gap-4">
          <SideButton icon={Bookmark} label="حفظ" active={isSaved} onClick={onToggleSave} />
          <SideButton icon={MessageCircle} label="سؤال" onClick={onAsk} />
          <SideButton icon={Share2} label="مشاركة" onClick={onShare} />
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
              onClick={onRequestQuote}
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
    </div>
  );
}
