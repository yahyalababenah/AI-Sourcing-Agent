import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { catalogService } from "@/services/catalogService";
import type { CatalogReviewPayload } from "@/services/catalogService";
import type { CatalogProduct } from "@/types/catalog";

export type ReviewStatusFilter = "all" | "pending" | "approved" | "rejected";

export const STATUS_LABEL: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
};

export const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-600",
};

// Admin oversight over the AI-derived global catalog — per CLAUDE.md's
// "إشراف الأدمن الكامل" principle this is a review/correction layer over
// AI output, not from-scratch CRUD. No "create product" action exists.
export function useAdminCatalogData() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>("pending");
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string | number>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-catalog", statusFilter, categoryFilter],
    queryFn: () =>
      catalogService.adminList({
        review_status: statusFilter === "all" ? undefined : statusFilter,
        category: categoryFilter,
        page_size: 50,
      }),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CatalogReviewPayload }) =>
      catalogService.reviewProduct(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-catalog"] });
      setEditingId(null);
      setEditForm({});
    },
  });

  const startEdit = (product: CatalogProduct) => {
    setEditingId(product.id);
    setEditForm({
      product_name: product.product_name ?? "",
      model_number: product.model_number ?? "",
      unit_price_rmb: product.unit_price_rmb ?? "",
      moq: product.moq ?? "",
      material: product.material ?? "",
      category: product.category ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  // "approve"/"reject" are reused across the full lifecycle: pending → approve/reject,
  // approved → "reject" doubles as "تعطيل" (pull from marketplace), rejected → "approve"
  // reinstates. The backend only knows these two states; a dedicated "disabled" status
  // doesn't exist, so disabling reuses "rejected" (same effect: hidden from Marketplace).
  const setStatus = (product: CatalogProduct, action: "approve" | "reject") => {
    reviewMutation.mutate({ id: product.id, payload: { action } });
  };

  const saveEdits = (product: CatalogProduct) => {
    const action: "approve" | "reject" = product.review_status === "rejected" ? "reject" : "approve";
    const payload: CatalogReviewPayload = { action };
    if (editForm.product_name) payload.product_name = String(editForm.product_name);
    if (editForm.model_number) payload.model_number = String(editForm.model_number);
    if (editForm.unit_price_rmb !== "") payload.unit_price_rmb = Number(editForm.unit_price_rmb);
    if (editForm.moq !== "") payload.moq = Number(editForm.moq);
    if (editForm.material) payload.material = String(editForm.material);
    if (editForm.category) payload.category = String(editForm.category);
    reviewMutation.mutate({ id: product.id, payload });
  };

  return {
    products: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading,
    error: error as Error | null,
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
  };
}
