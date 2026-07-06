import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pricingService } from "@/services/pricingService";
import type { PricingRule } from "@/types/pricing";

export const CATEGORY_LABELS: Record<string, string> = {
  exchange_rate: "سعر الصرف",
  freight: "الشحن",
  customs: "الجمارك",
  clearance: "التخليص",
  commission: "العمولة",
  discount: "الخصم",
  moq_discount: "خصم الكمية",
  tax: "الضريبة",
  margin: "هامش الربح",
  other: "أخرى",
};

export const RULE_TYPE_LABELS: Record<string, string> = {
  percentage: "نسبة مئوية",
  fixed: "قيمة ثابتة",
  formula: "معادلة",
};

// Shared data/filter/mutation logic for PricingRulesPageDesktop/Mobile — same
// split-file pattern as every other admin screen (see useAdminUsersData.ts).
// The route (/pricing/rules) is admin-only (see routeFactories.tsx), so no
// role check is needed inside the page itself.
export function usePricingRulesData() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);

  const { data, isLoading, error } = useQuery({
    queryKey: ["pricing-rules", categoryFilter],
    queryFn: () => pricingService.listRules({ category: categoryFilter }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pricingService.deleteRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing-rules"] });
    },
  });

  const handleAdd = () => {
    setEditingRule(undefined);
    setShowModal(true);
  };

  const handleEdit = (rule: PricingRule) => {
    setEditingRule(rule);
    setShowModal(true);
  };

  const handleDelete = (rule: PricingRule) => {
    if (confirm("هل أنت متأكد من حذف هذه القاعدة؟")) {
      deleteMutation.mutate(rule.id);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRule(undefined);
  };

  return {
    rules: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading,
    error: error as Error | null,
    categoryFilter,
    setCategoryFilter,
    showModal,
    editingRule,
    handleAdd,
    handleEdit,
    handleDelete,
    closeModal,
    deleteMutation,
  };
}
