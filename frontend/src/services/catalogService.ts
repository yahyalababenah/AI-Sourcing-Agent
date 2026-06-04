import { api } from "@/lib/api";
import { API } from "@/constants/api";
import type { CatalogListResponse } from "@/types/catalog";

export interface CatalogSearchParams {
  q?: string;
  category?: string;
  min_price?: number;
  max_price?: number;
  supplier_id?: string;
  page?: number;
  page_size?: number;
}

export const catalogService = {
  /** Search/browse the global product catalog with optional filters. */
  search: (params?: CatalogSearchParams) =>
    api
      .get<CatalogListResponse>(API.CATALOG.PRODUCTS, { params })
      .then((r) => r.data),
};
