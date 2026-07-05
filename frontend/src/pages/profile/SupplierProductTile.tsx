import type { CatalogProduct } from "@/types/catalog";

const formatPrice = (price: number | null) => (price == null ? "—" : `¥${price.toLocaleString()}`);

interface SupplierProductTileProps {
  product: CatalogProduct;
  onRequestQuote: () => void;
}

// Product grid tile for the "المنتجات" tab on the supplier's own profile —
// persistent price overlay (never hidden) + an explicit "طلب عرض" button per
// item, per CLAUDE.md T7.2. Distinct from the shared ReelTile (used for the
// "لقطات المصنع" tab instead) which has no separate action button.
export function SupplierProductTile({ product, onRequestQuote }: SupplierProductTileProps) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[4/3] bg-slate-100">
        <div className="absolute inset-x-0 bottom-0 bg-slate-900/85 px-2 py-1.5">
          <p className="truncate text-[11px] text-white">{product.product_name ?? "منتج بدون اسم"}</p>
          <p className="text-xs font-semibold tabular-nums text-white" dir="ltr">
            {formatPrice(product.unit_price_rmb)}
          </p>
        </div>
      </div>
      <button
        onClick={onRequestQuote}
        className="border-t border-slate-100 py-2 text-xs font-medium text-supplier-600 transition-colors duration-150 hover:bg-supplier-50 active:scale-[0.98]"
      >
        طلب عرض
      </button>
    </div>
  );
}
