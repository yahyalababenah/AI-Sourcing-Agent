import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pricingService } from "@/services/pricingService";
import type { HSCodeFeeSchedule } from "@/types/pricing";

// Shared data/filter/mutation logic for AdminHSCodeSchedulesPageDesktop/Mobile
// — same split-file pattern as every other admin screen (see useAdminUsersData.ts).
export function useHsCodeSchedulesData() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<HSCodeFeeSchedule | undefined>(undefined);

  const { data, isLoading, error } = useQuery({
    queryKey: ["hs-code-schedules"],
    queryFn: () => pricingService.listHsCodes(),
  });

  const deleteMutation = useMutation({
    mutationFn: (code: string) => pricingService.deleteHsCode(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hs-code-schedules"] });
    },
  });

  const handleAdd = () => {
    setEditingEntry(undefined);
    setShowModal(true);
  };

  const handleEdit = (entry: HSCodeFeeSchedule) => {
    setEditingEntry(entry);
    setShowModal(true);
  };

  const handleDelete = (entry: HSCodeFeeSchedule) => {
    if (confirm(`هل أنت متأكد من حذف رمز HS ${entry.hs_code}؟`)) {
      deleteMutation.mutate(entry.hs_code);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingEntry(undefined);
  };

  return {
    entries: data?.items ?? [],
    total: data?.items.length ?? 0,
    isLoading,
    error: error as Error | null,
    showModal,
    editingEntry,
    handleAdd,
    handleEdit,
    handleDelete,
    closeModal,
    deleteMutation,
  };
}
