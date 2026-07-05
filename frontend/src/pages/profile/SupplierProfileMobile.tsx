import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, ShieldCheck, BadgeCheck, Pencil, Video } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReelTile } from "@/components/ui/ReelTile";
import { useSupplierProfileData } from "./useSupplierProfileData";
import { SupplierProfileEditForm } from "./SupplierProfileEditForm";
import { SupplierProductTile } from "./SupplierProductTile";

const formatPrice = (price: number | null) => (price == null ? "—" : `¥${price.toLocaleString()}`);

function initialsOf(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

type Tab = "products" | "clips";

// Same content as SupplierProfileDesktop, stacked for mobile — mirrors
// ClientProfileMobile's structure (T7.1) with supplier-* tokens.
export function SupplierProfileMobile() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("products");
  const {
    factoryName,
    isVerified,
    products,
    productsLoading,
    location,
    closedDealsCount,
    avgResponseLabel,
    isEditing,
    form,
    startEditing,
    cancelEditing,
    updateField,
    save,
    isSaving,
  } = useSupplierProfileData();

  const goToInbox = () => navigate(ROUTES.RFQ.SUPPLIER_INBOX);

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden p-0">
        <div className="relative h-32 bg-gradient-to-br from-supplier-900 to-supplier-600">
          <button
            onClick={() => navigate(ROUTES.AGENT.REELS)}
            className="absolute start-4 top-4 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white transition-colors duration-150 hover:bg-white/25 active:scale-[0.98]"
          >
            <Play className="h-3 w-3" fill="currentColor" />
            جولة داخل المصنع
          </button>
          <div className="absolute -bottom-8 start-5 flex h-16 w-16 items-center justify-center rounded-full bg-white text-lg font-bold text-supplier-700 ring-4 ring-white">
            {initialsOf(factoryName)}
          </div>
        </div>

        <div className="px-4 pb-4 pt-10">
          <h1 className="text-lg font-bold text-slate-900">{factoryName}</h1>
          <p className="mt-0.5 text-xs text-slate-500">مصنع · {location}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {isVerified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-supplier-50 px-2 py-1 text-[11px] font-medium text-supplier-600">
                <ShieldCheck className="h-3 w-3" />
                مورد موثّق
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
              <BadgeCheck className="h-3 w-3" />
              ISO 9001
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-lg font-bold tabular-nums text-slate-900">{closedDealsCount}</div>
              <div className="mt-0.5 text-[10px] text-slate-500">صفقة مكتملة</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-lg font-bold text-emerald-600">0.82%</div>
              <div className="mt-0.5 text-[10px] text-slate-500">دقة التسعير</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-lg font-bold tabular-nums text-slate-900" dir="ltr">
                {avgResponseLabel}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500">زمن الرد</div>
            </div>
          </div>

          <button
            onClick={startEditing}
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-supplier-500 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-supplier-600 active:scale-[0.98]"
          >
            <Pencil className="h-4 w-4" />
            تعديل الملف
          </button>
        </div>
      </div>

      {isEditing && (
        <SupplierProfileEditForm
          form={form}
          onChange={updateField}
          onSave={save}
          onCancel={cancelEditing}
          isSaving={isSaving}
        />
      )}

      <div className="flex rounded-lg border border-slate-200 bg-white p-1">
        <button
          onClick={() => setTab("products")}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors duration-150 ${
            tab === "products" ? "bg-slate-900 text-white" : "text-slate-500"
          }`}
        >
          المنتجات
        </button>
        <button
          onClick={() => setTab("clips")}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors duration-150 ${
            tab === "clips" ? "bg-slate-900 text-white" : "text-slate-500"
          }`}
        >
          لقطات المصنع
        </button>
      </div>

      {productsLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState icon={Video} title="لا توجد منتجات بعد" description="ارفع كتالوج أو مستند منتجات لتظهر هنا" />
      ) : tab === "products" ? (
        <div className="grid grid-cols-2 gap-3">
          {products.map((p) => (
            <SupplierProductTile key={p.id} product={p} onRequestQuote={goToInbox} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map((p) => (
            <ReelTile
              key={p.id}
              price={formatPrice(p.unit_price_rmb)}
              product={p.product_name ?? "منتج بدون اسم"}
              rfqCount={0}
              onClick={() => navigate(ROUTES.AGENT.REELS)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
