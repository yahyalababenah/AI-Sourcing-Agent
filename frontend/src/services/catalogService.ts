import { api } from "@/lib/api";
import { API } from "@/constants/api";
import type { CatalogListResponse } from "@/types/catalog";

export const catalogService = {
  /** Search/browse the global product catalog. */
  search: (params?: { q?: string; page?: number; page_size?: number }) =>
    api
      .get<CatalogListResponse>(API.CATALOG.PRODUCTS, { params })
      .then((r) => r.data),
};
