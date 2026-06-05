import { api } from "@/lib/api";
import { API } from "@/constants/api";
import type {
  Product,
  ProductsBatchResponse,
  RFQ,
  RFQBatchResponse,
  RFQCreate,
  RFQListResponse,
  RFQMatch,
  RFQMatchListResponse,
  ClaimMatchRequest,
} from "@/types/intake";

export const intakeService = {
  /** Create a new RFQ. */
  create: (data: RFQCreate) =>
    api.post<RFQ>(API.INTAKE.RFQS, data).then((r) => r.data),

  /** List RFQs with optional status/supplier filters. */
  list: (params?: {
    status?: string;
    supplier_id?: string;
    page?: number;
    limit?: number;
  }) => api.get<RFQListResponse>(API.INTAKE.RFQS, { params }).then((r) => r.data),

  /** Get a single RFQ by ID. */
  get: (id: string) =>
    api.get<RFQ>(API.INTAKE.RFQ(id)).then((r) => r.data),

  /** Update RFQ status. */
  updateStatus: (id: string, status: string) =>
    api.put<RFQ>(API.INTAKE.RFQ_STATUS(id), null, { params: { new_status: status } }).then((r) => r.data),

  /** List products in an RFQ. */
  listProducts: (rfqId: string) =>
    api.get<Product[]>(API.INTAKE.RFQ_PRODUCTS(rfqId)).then((r) => r.data),

  /** Batch-fetch RFQs by IDs. */
  getBatch: (ids: string[]) =>
    api
      .post<RFQBatchResponse>(API.INTAKE.RFQ_BATCH, { ids })
      .then((r) => r.data),

  /** Batch-fetch products for multiple RFQs. */
  listProductsBatch: (rfqIds: string[]) =>
    api
      .post<ProductsBatchResponse>(API.INTAKE.RFQ_PRODUCTS_BATCH, { rfq_ids: rfqIds })
      .then((r) => r.data),

  // ═══════════════════════════════════════════════════════════
  // RFQ Matching
  // ═══════════════════════════════════════════════════════════

  /** Trigger matching algorithm for an RFQ (agent/admin only). */
  runMatching: (rfqId: string) =>
    api.post<RFQMatch[]>(API.INTAKE.RFQ_MATCH(rfqId)).then((r) => r.data),

  /** List exclusive matches for the authenticated supplier. */
  listMatched: (params?: {
    status?: string;
    page?: number;
    limit?: number;
  }) =>
    api
      .get<RFQMatchListResponse>(API.INTAKE.RFQ_MATCHED, { params })
      .then((r) => r.data),

  /** List public pool RFQs (expired exclusive windows). */
  listPublic: (params?: {
    status?: string;
    page?: number;
    limit?: number;
  }) =>
    api
      .get<RFQListResponse>(API.INTAKE.RFQ_PUBLIC, { params })
      .then((r) => r.data),

  /** Respond to an exclusive match (claim or decline). */
  claimMatch: (matchId: string, data: ClaimMatchRequest) =>
    api
      .post<RFQMatch>(API.INTAKE.MATCH_CLAIM(matchId), data)
      .then((r) => r.data),
};
