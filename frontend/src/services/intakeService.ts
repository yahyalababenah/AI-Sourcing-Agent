import { api } from "@/lib/api";
import { API } from "@/constants/api";
import type { RFQ, RFQCreate, RFQListResponse, Product } from "@/types/intake";

export const intakeService = {
  /** Create a new RFQ. */
  create: (data: RFQCreate) =>
    api.post<RFQ>(API.INTAKE.RFQS, data).then((r) => r.data),

  /** List RFQs with optional status filter. */
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<RFQListResponse>(API.INTAKE.RFQS, { params }).then((r) => r.data),

  /** Get a single RFQ by ID. */
  get: (id: string) =>
    api.get<RFQ>(API.INTAKE.RFQ(id)).then((r) => r.data),

  /** Update RFQ status. */
  updateStatus: (id: string, status: string) =>
    api.put<RFQ>(API.INTAKE.RFQ_STATUS(id), status, {
      headers: { "Content-Type": "application/json" },
    }).then((r) => r.data),

  /** List products in an RFQ. */
  listProducts: (rfqId: string) =>
    api.get<Product[]>(API.INTAKE.RFQ_PRODUCTS(rfqId)).then((r) => r.data),
};
