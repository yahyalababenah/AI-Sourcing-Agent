import { Link } from "react-router-dom";
import { Store, CheckCircle, XCircle, Edit2, Loader2, ExternalLink, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ROUTES } from "@/constants/routes";
import { categoryLabel, PRODUCT_CATEGORIES } from "@/constants/categories";
import { AdminCatalogEditFields } from "./AdminCatalogEditFields";
import { useAdminCatalogData, STATUS_LABEL, STATUS_BADGE, type ReviewStatusFilter } from "./useAdminCatalogData";

// No handoff-designs/*.html reference exists for admin catalog oversight —
// stacked cards per CLAUDE.md's mandatory mobile pattern, same data/actions
// as the desktop list (which is itself a card list, not a wide table, since
// the edit-in-place interaction doesn't fit table columns at any width).
const STATUS_TABS: { key: ReviewStatusFilter; label: string }[] = [
  { key: "pending", label: "قيد المراجعة" },
  { key: "approved", label: "معتمد" },
  { key: "rejected", label: "مرفوض" },
  { key: "all", label: "الكل" },
];

export function AdminCatalogPageMobile() {
  const {
    products,
    total,
    isLoading,
    error,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    editingId,
    editForm,
    setEditForm,
    startEdit,
    cancelEdit,
    setStatus,
    saveEdits,
    reviewMutation,
  } = useAdminCatalogData();

  return (
    <div className="space-y-4 pb-8">
      <div className="card space-y-3 p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white">
            <Store className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">الكتالوج العالمي</h1>
            <p className="text-xs text-slate-500">{total} منتج</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-150",
                statusFilter === tab.key ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <select
          value={categoryFilter ?? ""}
          onChange={(e) => setCategoryFilter(e.target.value || undefined)}
          className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 focus:border-slate-400 focus:outline-none"
        >
          <option value="">كل الفئات</option>
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card space-y-2 p-4">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-3 w-44 rounded" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && error && (
        <EmptyState icon={Store} title="تعذّر تحميل بيانات الكتالوج" description="حاول تحديث الصفحة" />
      )}

      {!isLoading && !error && products.length === 0 && (
        <EmptyState icon={Store} title="لا توجد منتجات مطابقة للفلاتر الحالية" />
      )}

      {!isLoading &&
        !error &&
        products.map((product) => {
          const isEditing = editingId === product.id;
          const isPending = reviewMutation.isPending && reviewMutation.variables?.id === product.id;
          const status = product.review_status ?? "pending";

          return (
            <div key={product.id} className="card space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{product.product_name || "—"}</p>
                  <p className="truncate text-xs text-slate-400">
                    {product.supplier_name || product.factory_name || "—"}
                  </p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_BADGE[status])}>
                  {STATUS_LABEL[status] ?? status}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                {product.unit_price_rmb && <span className="tabular-nums">¥ {product.unit_price_rmb.toLocaleString()}</span>}
                {product.category && <span>{categoryLabel(product.category)}</span>}
              </div>

              {product.document_id && (
                <Link
                  to={ROUTES.DOCUMENTS.DETAIL(product.document_id)}
                  className="inline-flex items-center gap-1 text-xs text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  المصدر: {product.document_file_name || "ملف"}
                </Link>
              )}

              {isEditing && <AdminCatalogEditFields form={editForm} onChange={setEditForm} />}

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => saveEdits(product)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white transition-all duration-150 hover:bg-slate-900 active:scale-[0.98] disabled:opacity-50"
                    >
                      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                      حفظ
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-all duration-150 hover:bg-slate-50 active:scale-[0.98]"
                    >
                      إلغاء
                    </button>
                  </>
                ) : (
                  <>
                    {status === "pending" && (
                      <>
                        <button
                          onClick={() => setStatus(product, "approve")}
                          disabled={isPending}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-all duration-150 hover:bg-emerald-50 active:scale-[0.98] disabled:opacity-50"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          اعتماد
                        </button>
                        <button
                          onClick={() => setStatus(product, "reject")}
                          disabled={isPending}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-all duration-150 hover:bg-red-50 active:scale-[0.98] disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          رفض
                        </button>
                      </>
                    )}
                    {status === "approved" && (
                      <button
                        onClick={() => setStatus(product, "reject")}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-all duration-150 hover:bg-red-50 active:scale-[0.98] disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        تعطيل
                      </button>
                    )}
                    {status === "rejected" && (
                      <button
                        onClick={() => setStatus(product, "approve")}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-all duration-150 hover:bg-emerald-50 active:scale-[0.98] disabled:opacity-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        إعادة اعتماد
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(product)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-all duration-150 hover:bg-slate-50 active:scale-[0.98]"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      تصحيح
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}
