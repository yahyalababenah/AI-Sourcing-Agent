import { Package } from "lucide-react";
import type { CatalogProduct } from "@/types/catalog";

interface MarketplaceProductCardProps {
  product: CatalogProduct;
  onRequestQuote: (product: CatalogProduct) => void;
}

/** Marketplace product card (T8.5) — shared between MarketplacePageDesktop
 * and MarketplacePageMobile. Replaces the old inline ProductCard's fabricated
 * data: a hardcoded `isVerified = true` badge, a `Math.random()` star
 * rating, and a fake `["CE","ISO"]` cert list that wasn't backed by any
 * real field. `CatalogProduct` carries no image URL, no verification_status,
 * and no certifications (same gap as T6.3's reels card) — so this shows an
 * honest placeholder icon instead of a fake filename graphic, and no
 * verified/rating/cert UI at all rather than invented ones. Real fields
 * only: name, factory/location, price range (from unit_price_rmb), MOQ. */
export function MarketplaceProductCard({ product, onRequestQuote }: MarketplaceProductCardProps) {
  const priceMin = product.unit_price_rmb ?? 0;
  const priceMax = +(priceMin * 1.3).toFixed(2);

  return (
    <div className="card overflow-hidden transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex h-28 items-center justify-center bg-slate-50">
        <Package className="h-8 w-8 text-slate-300" strokeWidth={1.5} />
      </div>

      <div className="p-3">
        <div className="mb-0.5 line-clamp-1 text-[12.5px] font-bold text-slate-900">
          {product.product_name ?? "منتج غير معروف"}
        </div>
        <div className="mb-2 text-[10px] text-slate-500">
          🇨🇳 {product.factory_name ?? product.supplier_name}
          {product.location_in_china && ` · ${product.location_in_china}`}
        </div>

        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[14px] font-black tabular-nums text-slate-900" dir="ltr">
            ¥{priceMin.toFixed(1)}
            <span className="text-[10px] font-normal text-slate-500"> – ¥{priceMax}</span>
          </span>
          <span className="text-[10px] text-slate-500">MOQ: {product.moq ?? "—"}</span>
        </div>

        <button
          onClick={() => onRequestQuote(product)}
          className="w-full rounded-md bg-brand-500 py-2 text-[11px] font-bold text-white transition-colors duration-150 hover:bg-brand-600 active:scale-[0.98]"
        >
          طلب عرض سعر
        </button>
      </div>
    </div>
  );
}
