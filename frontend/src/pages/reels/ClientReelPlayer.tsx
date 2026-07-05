import { Video, Bookmark, MessageCircle, Share2, UserPlus, UserCheck } from "lucide-react";
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
          active ? "bg-white text-importer-600" : "bg-white/15 text-white"
        }`}
      >
        <Icon className="h-4 w-4" fill={active ? "currentColor" : "none"} />
      </span>
      <span className="text-[10px] text-white/90">{label}</span>
    </button>
  );
}

interface ClientReelPlayerProps {
  product: CatalogProduct;
  index: number;
  total: number;
  isShortlisted: boolean;
  onToggleShortlist: () => void;
  isFollowingFactory: boolean;
  onToggleFollowFactory: () => void;
  onAsk: () => void;
  onShare: () => void;
  onRequestQuote: () => void;
  /** Sizing/positioning owned by the caller — full-bleed on mobile, a 300px
   * sticky column on desktop — same split as the supplier ReelPlayer. */
  className?: string;
}

// Consumer-facing player chrome — same visual language as the supplier
// ReelPlayer (persistent commercial bottom overlay, side action buttons,
// gradient background) but every action is reinterpreted from the
// consumption side per CLAUDE.md: "إعجاب"→shortlist, "متابعة"→factory
// alerts, "سؤال"→RFQ-bound chat, "طلب عرض سعر" always present. No upload
// button and no RFQ/views counters — those are supplier-only metrics.
export function ClientReelPlayer({
  product,
  index,
  total,
  isShortlisted,
  onToggleShortlist,
  isFollowingFactory,
  onToggleFollowFactory,
  onAsk,
  onShare,
  onRequestQuote,
  className = "",
}: ClientReelPlayerProps) {
  const factoryName = product.factory_name ?? product.supplier_name ?? "مصنع غير مسمّى";

  return (
    <div className={`relative overflow-hidden bg-gradient-to-b from-importer-900 to-importer-600 ${className}`}>
      <div key={product.id} className="absolute inset-0 flex animate-[totalReveal_250ms_ease-out] flex-col">
        <div className="flex items-center justify-between p-3">
          <button
            onClick={onToggleFollowFactory}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 active:scale-[0.98] ${
              isFollowingFactory ? "bg-white text-importer-900" : "bg-white/15 text-white hover:bg-white/25"
            }`}
          >
            {isFollowingFactory ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
            {isFollowingFactory ? "متابَع" : "تابع المصنع"}
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
          <SideButton icon={Bookmark} label="حفظ" active={isShortlisted} onClick={onToggleShortlist} />
          <SideButton icon={MessageCircle} label="سؤال" onClick={onAsk} />
          <SideButton icon={Share2} label="مشاركة" onClick={onShare} />
        </div>

        <div className="space-y-2 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">{factoryName}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-xs font-semibold text-white">
              {initialsOf(factoryName)}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              onClick={onRequestQuote}
              className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-importer-900 transition-transform duration-150 active:scale-[0.98]"
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

          {(product.moq || product.category) && (
            <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[11px] text-white/70">
              <span>{product.category ?? "—"}</span>
              {product.moq && <span dir="ltr">MOQ {product.moq.toLocaleString()}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
