import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, ShieldCheck, BadgeCheck, MessageCircle, Pencil, Video } from "lucide-react";
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

// No supplier-profile-*.html reference exists in handoff-designs/ (same gap
// as T6.3's consumer player) — built from CLAUDE.md's T7.2 spec, matching
// ClientProfileDesktop's visual language (T7.1) with supplier-* tokens.
export function SupplierProfileDesktop() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("products");
  const {
    user,
    factoryName,
    isVerified,
    products,
    productsLoading,
    location,
    specialty,
    factoryAddress,
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
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="card overflow-hidden p-0">
        {/* Cover */}
        <div className="relative h-40 bg-gradient-to-br from-supplier-900 to-supplier-600">
          <button
            onClick={() => navigate(ROUTES.AGENT.REELS)}
            className="absolute start-6 top-5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white transition-colors duration-150 hover:bg-white/25 active:scale-[0.98]"
          >
            <Play className="h-3.5 w-3.5" fill="currentColor" />
            شاهد جولة داخل المصنع
          </button>
          <div className="absolute -bottom-10 start-8 flex h-20 w-20 items-center justify-center rounded-full bg-white text-xl font-bold text-supplier-700 ring-4 ring-white">
            {initialsOf(factoryName)}
          </div>
        </div>

        <div className="px-6 pb-6 pt-12">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{factoryName}</h1>
              <p className="mt-0.5 text-sm text-slate-500">مصنع · {location}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {isVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-supplier-50 px-2.5 py-1 text-xs font-medium text-supplier-600">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    مورد موثّق
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  ISO 9001
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(ROUTES.CHAT.LIST)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50 active:scale-[0.98]"
              >
                <MessageCircle className="h-4 w-4" />
                محادثة
              </button>
              <button
                onClick={startEditing}
                className="flex items-center gap-1.5 rounded-lg bg-supplier-500 px-3.5 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-supplier-600 active:scale-[0.98]"
              >
                <Pencil className="h-4 w-4" />
                تعديل الملف
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <div className="text-2xl font-bold tabular-nums text-slate-900">{closedDealsCount}</div>
              <div className="mt-1 text-xs text-slate-500">صفقة مكتملة</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">0.82%</div>
              <div className="mt-1 text-xs text-slate-500">دقة التسعير</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <div className="text-2xl font-bold tabular-nums text-slate-900" dir="ltr">
                {avgResponseLabel}
              </div>
              <div className="mt-1 text-xs text-slate-500">متوسط زمن الرد</div>
            </div>
          </div>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <div className="card space-y-4 p-5">
          <h2 className="text-sm font-semibold text-slate-900">بيانات المصنع</h2>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-slate-400">الموقع في الصين</p>
              <p className="mt-0.5 font-medium text-slate-900">{location}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">التخصص</p>
              <p className="mt-0.5 font-medium text-slate-900">{specialty}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">عنوان المصنع</p>
              <p className="mt-0.5 font-medium text-slate-900">{factoryAddress}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">البريد الإلكتروني</p>
              <p className="mt-0.5 font-medium text-slate-900" dir="ltr">
                {user?.email ?? "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-4 flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              onClick={() => setTab("products")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors duration-150 ${
                tab === "products" ? "bg-white text-supplier-700 shadow-sm" : "text-slate-500"
              }`}
            >
              المنتجات
            </button>
            <button
              onClick={() => setTab("clips")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors duration-150 ${
                tab === "clips" ? "bg-white text-supplier-700 shadow-sm" : "text-slate-500"
              }`}
            >
              لقطات المصنع
            </button>
          </div>

          {productsLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <EmptyState icon={Video} title="لا توجد منتجات بعد" description="ارفع كتالوج أو مستند منتجات لتظهر هنا" />
          ) : tab === "products" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {products.map((p) => (
                <SupplierProductTile key={p.id} product={p} onRequestQuote={goToInbox} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
      </div>
    </div>
  );
}
