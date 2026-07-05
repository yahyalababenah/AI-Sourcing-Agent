import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Search, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { catalogService } from "@/services/catalogService";
import { useAuthStore } from "@/stores/authStore";
import { ROUTES } from "@/constants/routes";
import type { CatalogProduct } from "@/types/catalog";

const formatPrice = (price: number | null) =>
  price == null ? "—" : `¥${price.toLocaleString()}`;

// A tint rotation so tiles without cover media still read as distinct cards.
const TINTS = [
  "bg-supplier-50", "bg-supplier-100", "bg-slate-100", "bg-supplier-50", "bg-slate-100",
];

function ReelTile({ product, index }: { product: CatalogProduct; index: number }) {
  const navigate = useNavigate();
  const tint = TINTS[index % TINTS.length];

  return (
    <div
      className={`relative rounded-xl overflow-hidden aspect-[2/3] ${tint} border border-slate-200 cursor-pointer group`}
      onClick={() => navigate(ROUTES.CATALOG.SUPPLIER_SHOWROOM(product.supplier_id ?? ""))}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-9 h-9 rounded-full bg-white/85 flex items-center justify-center">
          <Play className="w-4 h-4 text-supplier-500" fill="currentColor" />
        </div>
      </div>

      {/* Product name */}
      <div className="absolute top-2 right-2 left-2">
        <p className="text-[11px] font-semibold text-supplier-900 line-clamp-2">
          {product.product_name ?? "منتج بدون اسم"}
        </p>
      </div>

      {/* Commercial overlay — always visible, per CLAUDE.md's reels logic */}
      <div className="absolute bottom-2 right-2 left-2 bg-slate-900/85 rounded-lg py-1.5 px-2 text-center">
        <span className="text-white text-[11px]">
          {formatPrice(product.unit_price_rmb)}
          {product.moq ? ` · MOQ ${product.moq.toLocaleString()}` : ""}
        </span>
      </div>
    </div>
  );
}

// Temporary placeholder — still the old tile-grid gallery, unchanged. T6.2
// replaces this with the real 300px-player + performance-panel layout from
// supplier-reels-desktop.html (matches the T5.1/T3.1 pattern of building one
// breakpoint first and leaving the other as a literal port until its own task).
export function ReelsStudioPageDesktop() {
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState("");
  const supplierId = user?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["reels-my-products", supplierId, search],
    queryFn: () =>
      catalogService.search({ supplier_id: supplierId, q: search || undefined, page_size: 24 }),
    enabled: !!supplierId,
  });

  const products = data?.items ?? [];

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-slate-900">أستوديو اللقطات</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">
            اعرض منتجاتك بصرياً — المقياس الحقيقي هو طلبات عروض الأسعار، لا المشاهدات
          </p>
        </div>
        <div className="relative">
          <Search className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في منتجاتك..."
            className="w-full sm:w-64 rounded-lg border border-slate-200 py-2 pe-9 ps-3 text-[13px] outline-none focus:border-supplier-500"
          />
        </div>
      </div>

      {/* Honest note: video upload isn't wired to a media backend yet — this
          view surfaces real catalog products, not placeholder video clips. */}
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
        <Video className="h-4 w-4 shrink-0" />
        رفع الفيديو غير متاح بعد — هذه البلاطات تعرض منتجاتك الحقيقية من الكتالوج بانتظار ميزة اللقطات المرئية
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-lg border border-slate-200 p-12 text-center">
          <Video className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-4 text-[14px] font-medium text-slate-600">لا توجد منتجات بعد</h3>
          <p className="mt-2 text-[12px] text-slate-400">
            ارفع كتالوج أو مستند منتجات لتظهر بلاطاتها هنا
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {products.map((p, i) => (
            <ReelTile key={p.id} product={p} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
