import { api } from "@/lib/api";
import type { User, SupplierProfile, ClientProfile } from "@/types/auth";

/** Response shape from GET /api/v1/admin/stats */
export interface AdminStats {
  total_users: number;
  users_by_role: Record<string, number>;
  total_rfqs: number;
  total_documents: number;
  total_quotations: number;
  total_pricing_rules: number;
  total_catalog_products: number;
}

/** Response shape from GET /api/v1/admin/ai-costs */
export interface AiCostStats {
  total_cost: string;
  total_calls: number;
  cost_last_24h: string;
  calls_last_24h: number;
  by_model: Array<{ model: string; calls: number; cost: number }>;
  by_provider: Array<{ provider: string; calls: number; cost: number }>;
  period_days: number;
}

/** Response shape from GET /api/v1/admin/users */
export interface UserListItem {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  profile?: SupplierProfile | ClientProfile | null;
}

export interface UsersListResponse {
  items: UserListItem[];
  total: number;
}

export interface UpdateVerificationPayload {
  verification_status: "pending" | "verified" | "rejected";
  rejection_reason?: string;
}

export const monitoringService = {
  /** Get system-wide statistics (admin only). */
  getStats: () =>
    api.get<AdminStats>("/admin/stats").then((r) => r.data),

  /** Get AI cost statistics (admin only). */
  getAiCosts: (days = 30) =>
    api.get<AiCostStats>("/admin/ai-costs", { params: { days } }).then((r) => r.data),

  /** List all users (admin only). */
  listUsers: (params?: { role?: string; active_only?: boolean; verification_status?: string }) =>
    api.get<UsersListResponse>("/admin/users", { params }).then((r) => r.data),

  /** Activate/deactivate a user (admin only). */
  toggleUserStatus: (userId: string, isActive: boolean) =>
    api.put(`/admin/users/${userId}/status`, null, {
      params: { is_active: isActive },
    }).then((r) => r.data),

  /** Update supplier verification status (admin only). */
  updateVerificationStatus: (userId: string, payload: UpdateVerificationPayload) =>
    api.put<User>(`/admin/users/${userId}/verification`, payload).then((r) => r.data),
};
