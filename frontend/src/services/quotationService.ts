import { api } from "@/lib/api";
import { API } from "@/constants/api";
import type {
  Quotation,
  QuotationCreate,
  QuotationListResponse,
  QuotationGenerateRequest,
  QuotationGenerateAcceptedResponse,
} from "@/types/quotes";

export const quotationService = {
  /** Create a new quotation. */
  create: (data: QuotationCreate) =>
    api.post<Quotation>(API.QUOTES.CREATE, data).then((r) => r.data),

  /** List quotations. */
  list: (params?: { rfq_id?: string; status?: string; limit?: number }) =>
    api.get<QuotationListResponse>(API.QUOTES.LIST, { params }).then((r) => r.data),

  /** Get a single quotation by ID. */
  get: (id: string) =>
    api.get<Quotation>(API.QUOTES.QUOTE(id)).then((r) => r.data),

  /** Update quotation status. */
  updateStatus: (id: string, status: string) =>
    api
      .put<Quotation>(API.QUOTES.STATUS(id), status, {
        headers: { "Content-Type": "application/json" },
      })
      .then((r) => r.data),

  /** Generate quotation asynchronously (Celery). */
  generate: (data: QuotationGenerateRequest) =>
    api
      .post<QuotationGenerateAcceptedResponse>(API.QUOTES.GENERATE, data)
      .then((r) => r.data),

  /** Client accepts a quotation. */
  accept: (id: string) =>
    api.post<import("@/types/quotes").Quotation>(API.QUOTES.ACCEPT(id)).then((r) => r.data),

  /** Client rejects a quotation. */
  reject: (id: string) =>
    api.post<import("@/types/quotes").Quotation>(API.QUOTES.REJECT(id)).then((r) => r.data),

  /** Generate PDF for a quotation (synchronous). */
  generatePdf: (id: string, showDetails = false) =>
    api
      .post<{ task_id: string; status: string }>(API.QUOTES.PDF(id), undefined, {
        params: { show_details: showDetails },
      })
      .then((r) => r.data),

  /** Get presigned PDF URL (redirect). */
  getPdfUrl: (id: string) => API.QUOTES.PDF(id),
};
