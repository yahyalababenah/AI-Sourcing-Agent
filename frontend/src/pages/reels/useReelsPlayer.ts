import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ROUTES } from "@/constants/routes";
import type { CatalogProduct } from "@/types/catalog";

/** Shared clip-navigation + action wiring for the reels player — used by both
 * ReelsStudioPageDesktop and ReelsStudioPageMobile so the two layout files
 * never duplicate the index/save/share/ask/upload logic (mirrors
 * usePricingCalculator's role for the pricing calculator). */
export function useReelsPlayer(products: CatalogProduct[]) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const product = products[index];

  const goNext = () => setIndex((i) => Math.min(i + 1, products.length - 1));
  const goPrev = () => setIndex((i) => Math.max(i - 1, 0));
  const selectIndex = (i: number) => setIndex(i);

  const toggleSave = () => {
    if (!product) return;
    setSaved((s) => ({ ...s, [product.id]: !s[product.id] }));
  };

  // No bookmark/analytics backend exists yet — this is a local UI toggle
  // only, not persisted, same honesty stance as the zero RFQ count below.
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
  // Supplier viewing their own reel — "طلب عرض" makes sense as "go manage the
  // real RFQs this product has received", not "request a quote for my own
  // product". See ROUTES.RFQ.SUPPLIER_INBOX.
  const handleRequestQuote = () => navigate(ROUTES.RFQ.SUPPLIER_INBOX);

  return {
    index,
    product,
    goNext,
    goPrev,
    selectIndex,
    hasNext: index < products.length - 1,
    hasPrev: index > 0,
    saved,
    toggleSave,
    handleShare,
    handleAsk,
    handleUpload,
    handleRequestQuote,
  };
}
