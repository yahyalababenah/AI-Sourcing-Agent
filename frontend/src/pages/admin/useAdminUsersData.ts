import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { monitoringService } from "@/services/monitoringService";
import type { UserRole } from "@/types/auth";

export type RoleFilter = "all" | UserRole;
export type StatusFilter = "all" | "active" | "inactive";

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "إدارة",
  agent: "مورد",
  client: "مستورد",
};

// Shared data/filter/mutation logic for AdminUsersPageDesktop/Mobile — same
// split-file pattern as every other admin screen (see useAdminMonitorData.ts).
export function useAdminUsersData() {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users", "all", roleFilter],
    queryFn: () =>
      monitoringService.listUsers({
        role: roleFilter === "all" ? undefined : roleFilter,
      }),
  });

  // Backend only supports an active-only filter (no explicit inactive-only
  // param) — filter the inactive case client-side on the already-fetched list.
  const users = useMemo(() => {
    const items = data?.items ?? [];
    if (statusFilter === "active") return items.filter((u) => u.is_active);
    if (statusFilter === "inactive") return items.filter((u) => !u.is_active);
    return items;
  }, [data, statusFilter]);

  const toggleMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      monitoringService.toggleUserStatus(userId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const handleToggle = (userId: string, currentlyActive: boolean) => {
    toggleMutation.mutate({ userId, isActive: !currentlyActive });
  };

  return {
    users,
    total: data?.total ?? 0,
    isLoading,
    error,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    toggleMutation,
    handleToggle,
  };
}
