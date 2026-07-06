import { api } from "@/lib/api";
import { API } from "@/constants/api";
import type { CatalogListResponse, CatalogProduct } from "@/types/catalog";

export interface CatalogSearchParams {
  q?: string;
  category?: string;
  min_price?: number;
  max_price?: number;
  supplier_id?: string;
  page?: number;
  page_size?: number;
}

export interface AdminCatalogListParams {
  review_status?: "pending" | "approved" | "rejected";
  q?: string;
  category?: string;
  supplier_id?: string;
  page?: number;
  page_size?: number;
}

export interface CatalogReviewPayload {
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

export const catalogService = {
  /** Search/browse the global product catalog with optional filters. */
  search: (params?: CatalogSearchParams) =>
    api
      .get<CatalogListResponse>(API.CATALOG.PRODUCTS, { params })
      .then((r) => r.data),

  /** Admin-only: browse the catalog across all suppliers and review statuses. */
  adminList: (params?: AdminCatalogListParams) =>
    api.get<CatalogListResponse>(API.CATALOG.ADMIN, { params }).then((r) => r.data),

  /** Approve/reject a product, optionally correcting AI-extracted fields.
   * Admins may act on any supplier's product (see CLAUDE.md's "إشراف الأدمن الكامل"). */
  reviewProduct: (productId: string, payload: CatalogReviewPayload) =>
    api.patch<CatalogProduct>(API.CATALOG.REVIEW(productId), payload).then((r) => r.data),
};
