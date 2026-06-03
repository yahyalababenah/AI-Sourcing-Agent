import { api } from "@/lib/api";
import { API } from "@/constants/api";
import type {
  Document,
  DocumentListResponse,
  DocumentUploadResponse,
  DocumentStatusResponse,
  ItemsUpdateRequest,
  ItemsUpdateResponse,
} from "@/types/documents";

export const documentService = {
  /** Upload a document to an RFQ. */
  upload: (rfqId: string, file: File) => {
    const formData = new FormData();
    formData.append("rfq_id", rfqId);
    formData.append("file", file);
    return api
      .post<DocumentUploadResponse>(API.DOCUMENTS.UPLOAD, formData)
      .then((r) => r.data);
  },

  /** List documents for an RFQ. */
  listByRfq: (rfqId: string) =>
    api.get<DocumentListResponse>(API.DOCUMENTS.LIST(rfqId)).then((r) => r.data),

  /** Get a single document by ID. */
  get: (id: string) =>
    api.get<Document>(API.DOCUMENTS.DOCUMENT(id)).then((r) => r.data),

  /** Delete a document. */
  delete: (id: string) =>
    api.delete(API.DOCUMENTS.DOCUMENT(id)).then((r) => r.data),

  /** Trigger vision processing on a document. */
  process: (id: string, provider?: string) =>
    api
      .post<{ document_id: string; status: string; extracted_entities: Record<string, unknown> }>(
        API.DOCUMENTS.PROCESS(id),
        undefined,
        { params: provider ? { provider } : {} }
      )
      .then((r) => r.data),

  /** Poll document processing status. */
  getStatus: (id: string) =>
    api.get<DocumentStatusResponse>(API.DOCUMENTS.STATUS(id)).then((r) => r.data),

  /** Get extracted product items. */
  getItems: (id: string) =>
    api.get<{ items: unknown[]; total: number }>(API.DOCUMENTS.ITEMS(id)).then((r) => r.data),

  /** Override extracted items. */
  updateItems: (id: string, data: ItemsUpdateRequest) =>
    api.put<ItemsUpdateResponse>(API.DOCUMENTS.ITEMS(id), data).then((r) => r.data),
};
