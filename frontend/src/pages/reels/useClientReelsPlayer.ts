import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ROUTES } from "@/constants/routes";
import type { CatalogProduct } from "@/types/catalog";

/** Shared clip-navigation + action wiring for the consumer reels feed —
 * mirrors useReelsPlayer's role for the supplier studio, but reinterprets
 * every action from the consumption side per CLAUDE.md's "منطق الريلز
 * التجاري" (المستورد): "إعجاب" → shortlist, "متابعة المصنع" → alert
 * subscription, "سؤال" → RFQ-bound chat, "طلب عرض سعر" always present. No
 * shortlist/follow backend exists yet (same as the supplier save toggle) —
 * these are local UI toggles only, not persisted. */
export function useClientReelsPlayer(products: CatalogProduct[]) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [shortlisted, setShortlisted] = useState<Record<string, boolean>>({});
  const [followedFactories, setFollowedFactories] = useState<Record<string, boolean>>({});

  const product = products[index];
  const factoryKey = product?.supplier_id ?? product?.factory_name ?? "";

  const goNext = () => setIndex((i) => Math.min(i + 1, products.length - 1));
  const goPrev = () => setIndex((i) => Math.max(i - 1, 0));
  const selectIndex = (i: number) => setIndex(i);

  const toggleShortlist = () => {
    if (!product) return;
    setShortlisted((s) => ({ ...s, [product.id]: !s[product.id] }));
  };

  const toggleFollowFactory = () => {
    if (!factoryKey) return;
    const willFollow = !followedFactories[factoryKey];
    setFollowedFactories((f) => ({ ...f, [factoryKey]: willFollow }));
    toast.success(willFollow ? "تم الاشتراك بتنبيهات هذا المصنع" : "تم إلغاء الاشتراك");
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

  // "سؤال" opens a conversation that leads to an RFQ, per CLAUDE.md.
  const handleAsk = () => navigate(ROUTES.CHAT.LIST);
  const handleRequestQuote = () => navigate(ROUTES.RFQ.CREATE);

  return {
    index,
    product,
    goNext,
    goPrev,
    selectIndex,
    hasNext: index < products.length - 1,
    hasPrev: index > 0,
    isShortlisted: !!product && !!shortlisted[product.id],
    toggleShortlist,
    isFollowingFactory: !!factoryKey && !!followedFactories[factoryKey],
    toggleFollowFactory,
    handleShare,
    handleAsk,
    handleRequestQuote,
  };
}
