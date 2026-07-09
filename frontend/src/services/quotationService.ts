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

  /** Create a standalone quotation — no RFQ required. */
  createStandalone: (data: QuotationCreate) =>
    api.post<Quotation>(API.QUOTES.CREATE_STANDALONE, data).then((r) => r.data),

  /** List quotations. */
  list: (params?: { rfq_id?: string; status?: string; limit?: number }) =>
    api.get<QuotationListResponse>(API.QUOTES.LIST, { params }).then((r) => r.data),

  /** Get a single quotation by ID. */
  get: (id: string) =>
    api.get<Quotation>(API.QUOTES.QUOTE(id)).then((r) => r.data),

  /** Update quotation status.
   *
   * The backend (`PUT /quotes/{id}/status`) declares `new_status` as a plain
   * function parameter with no request-body model, which FastAPI treats as a
   * query parameter — not a JSON body. This previously sent `status` as the
   * request body, which the backend would reject (422, missing `new_status`
   * query param). Fixed to match the real contract. This method had zero
   * call sites before the "send quote" button below was added, so the bug
   * was latent rather than already breaking a shipped feature.
   */
  updateStatus: (id: string, status: string) =>
    api
      .put<Quotation>(API.QUOTES.STATUS(id), null, { params: { new_status: status } })
      .then((r) => r.data),

  /** Finalize a quotation: generates the PDF synchronously, sets status to
   * "finalized", and moves the parent RFQ to "quoted". */
  finalize: (id: string) =>
    api.post<Quotation>(API.QUOTES.FINALIZE(id)).then((r) => r.data),

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
