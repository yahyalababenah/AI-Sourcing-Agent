import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { API } from "@/constants/api";
import { PRODUCT_CATEGORIES, categoryLabel } from "@/constants/categories";
import type { CatalogProduct } from "@/types/catalog";
import { CheckCircle, XCircle, Edit2, Loader2, ChevronDown, ChevronUp } from "lucide-react";

const OTHER_CATEGORY = "__other__";

interface PendingListResponse {
  items: CatalogProduct[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface ReviewPayload {
  action: "approve" | "reject";
  product_name?: string;
  model_number?: string;
  unit_price_rmb?: number;
  moq?: number;
  weight_kg?: number;
  dimensions?: string;
  material?: string;
  category?: string;
}

async function fetchPending(page: number): Promise<PendingListResponse> {
  const res = await api.get<PendingListResponse>(API.CATALOG.PENDING, { params: { page, page_size: 30 } });
  return res.data;
}

async function submitReview(productId: string, payload: ReviewPayload): Promise<CatalogProduct> {
  const res = await api.patch<CatalogProduct>(API.CATALOG.REVIEW(productId), payload);
  return res.data;
}

export function ProductReviewPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string | number>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery<PendingListResponse>({
    queryKey: ["pending-products", page],
    queryFn: () => fetchPending(page),
    staleTime: 10_000,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReviewPayload }) =>
      submitReview(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-products"] });
      setEditId(null);
      setEditForm({});
    },
  });

  const approve = (id: string) =>
    reviewMutation.mutate({ id, payload: { action: "approve" } });

  const approveWithEdits = (id: string) => {
    const payload: ReviewPayload = { action: "approve" };
    if (editForm.product_name) payload.product_name = String(editForm.product_name);
    if (editForm.model_number) payload.model_number = String(editForm.model_number);
    if (editForm.unit_price_rmb) payload.unit_price_rmb = Number(editForm.unit_price_rmb);
    if (editForm.moq) payload.moq = Number(editForm.moq);
    if (editForm.category) {
      payload.category =
        editForm.category === OTHER_CATEGORY
          ? String(editForm.category_other ?? "")
          : String(editForm.category);
    }
    if (editForm.material) payload.material = String(editForm.material);
    reviewMutation.mutate({ id, payload });
  };

  const reject = (id: string) =>
    reviewMutation.mutate({ id, payload: { action: "reject" } });

  const startEdit = (p: CatalogProduct) => {
    setEditId(p.id);
    const isCanonical = !p.category || PRODUCT_CATEGORIES.some((c) => c.value === p.category);
    setEditForm({
      product_name: p.product_name ?? "",
      model_number: p.model_number ?? "",
      unit_price_rmb: p.unit_price_rmb ?? "",
      moq: p.moq ?? "",
      category: isCanonical ? (p.category ?? "") : OTHER_CATEGORY,
      category_other: isCanonical ? "" : (p.category ?? ""),
      material: p.material ?? "",
    });
  };

  const pending = reviewMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h1 className="text-lg font-bold text-gray-900">مراجعة المنتجات المستخرجة</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          وافق أو ارفض المنتجات التي استخرجها الذكاء الاصطناعي من كاتالوجاتك قبل ظهورها للعملاء
        </p>
      </div>

      {/* Stats */}
      {data && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-5 py-3 text-sm text-amber-700">
          <span className="font-semibold">{data.total}</span> منتج ينتظر مراجعتك
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="p-10 text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-gray-300" />
          <p className="mt-3 text-sm text-gray-400">جاري التحميل...</p>
        </div>
      )}

      {/* Empty */}
      {!isLoading && data?.items.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <CheckCircle className="mx-auto h-10 w-10 text-green-300" />
          <p className="mt-3 text-sm font-medium text-gray-600">لا توجد منتجات تنتظر المراجعة</p>
          <p className="mt-1 text-xs text-gray-400">جميع المنتجات المستخرجة تمت مراجعتها</p>
        </div>
      )}

      {/* Product cards */}
      <div className="space-y-3">
        {data?.items.map((product) => {
          const isEditing = editId === product.id;
          const isExpanded = expanded === product.id;

          return (
            <div
              key={product.id}
              className="rounded-xl border border-gray-200 bg-white overflow-hidden"
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-gray-900">
                      {isEditing ? (
                        <input
                          className="w-full rounded border border-gray-300 px-2 py-0.5 text-sm"
                          value={String(editForm.product_name ?? "")}
                          onChange={(e) => setEditForm((f) => ({ ...f, product_name: e.target.value }))}
                        />
                      ) : (
                        product.product_name || "—"
                      )}
                    </p>
                    {product.model_number && !isEditing && (
                      <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
                        {product.model_number}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                    {product.unit_price_rmb && (
                      <span>¥ {product.unit_price_rmb.toLocaleString()}</span>
                    )}
                    {product.moq && <span>MOQ: {product.moq}</span>}
                    {product.category && <span className="text-blue-600">{categoryLabel(product.category)}</span>}
                    {product.material && <span>{product.material}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => approveWithEdits(product.id)}
                        disabled={pending}
                        className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        حفظ وقبول
                      </button>
                      <button
                        onClick={() => { setEditId(null); setEditForm({}); }}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        إلغاء
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => approve(product.id)}
                        disabled={pending}
                        className="flex items-center gap-1 rounded-lg bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-200 disabled:opacity-50"
                        title="قبول"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        قبول
                      </button>
                      <button
                        onClick={() => startEdit(product)}
                        className="flex items-center gap-1 rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-200"
                        title="تعديل وقبول"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        تعديل
                      </button>
                      <button
                        onClick={() => reject(product.id)}
                        disabled={pending}
                        className="flex items-center gap-1 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
                        title="رفض"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        رفض
                      </button>
                      <button
                        onClick={() => setExpanded(isExpanded ? null : product.id)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Edit form extra fields */}
              {isEditing && (
                <div className="grid grid-cols-2 gap-3 border-t border-gray-100 bg-gray-50 p-4 sm:grid-cols-3">
                  {[
                    { key: "model_number", label: "رقم الموديل" },
                    { key: "unit_price_rmb", label: "السعر (RMB)", type: "number" },
                    { key: "moq", label: "الحد الأدنى للطلب", type: "number" },
                    { key: "material", label: "الخامة" },
                  ].map(({ key, label, type = "text" }) => (
                    <div key={key}>
                      <label className="mb-1 block text-[11px] text-gray-500">{label}</label>
                      <input
                        type={type}
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs focus:border-primary-400 focus:outline-none"
                        value={String(editForm[key] ?? "")}
                        onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <div>
                    <label className="mb-1 block text-[11px] text-gray-500">الفئة</label>
                    <select
                      className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs focus:border-primary-400 focus:outline-none"
                      value={String(editForm.category ?? "")}
                      onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                    >
                      <option value="">—</option>
                      {PRODUCT_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                      <option value={OTHER_CATEGORY}>أخرى...</option>
                    </select>
                    {editForm.category === OTHER_CATEGORY && (
                      <input
                        type="text"
                        placeholder="اكتب الفئة"
                        className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs focus:border-primary-400 focus:outline-none"
                        value={String(editForm.category_other ?? "")}
                        onChange={(e) => setEditForm((f) => ({ ...f, category_other: e.target.value }))}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Expanded details */}
              {isExpanded && !isEditing && (
                <div className="grid grid-cols-2 gap-2 border-t border-gray-100 bg-gray-50 p-4 text-xs sm:grid-cols-3">
                  {[
                    ["وزن (kg)", product.weight_kg],
                    ["الأبعاد", product.dimensions],
                    ["مصدر الكاتالوج", product.document_file_name],
                  ].filter(([, v]) => v).map(([label, val]) => (
                    <div key={String(label)}>
                      <p className="text-gray-400">{label}</p>
                      <p className="font-medium text-gray-700">{String(val)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-center gap-3 py-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            السابق
          </button>
          <span className="text-sm text-gray-500">
            {page} / {data.total_pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
            disabled={page === data.total_pages}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}
