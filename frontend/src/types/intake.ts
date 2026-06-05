export interface TranslateRequest {
  raw_text: string;
}

export interface TranslateResponse {
  request_id: string;
  chinese_query: string;
  entities: Record<string, string>;
  confidence: number;
}

export interface RFQCreate {
  client_name: string;
  client_phone?: string;
  client_request_arabic: string;
  translated_query_chinese?: string;
  extracted_entities?: Record<string, unknown>;
  destination_port?: string;
  target_currency?: string;
}

export interface RFQ {
  id: string;
  client_name: string;
  client_phone?: string;
  client_request_arabic: string;
  translated_query_chinese?: string;
  extracted_entities?: Record<string, unknown>;
  destination_port?: string;
  target_currency: string;
  status: string;
  agent_id?: string;
  client_id?: string;
  created_at: string;
  updated_at: string;

  // ── Matching fields ──
  matched_supplier_ids?: string[];
  exclusive_deadline?: string | null;
  is_public: boolean;
}

export interface RFQListResponse {
  items: RFQ[];
  total: number;
  page: number;
  page_size: number;
}

export interface Product {
  id: string;
  rfq_id: string;
  name: string;
  quantity: number;
  specifications?: string;
  target_price?: number;
  extracted_metadata?: Record<string, unknown>;
  status: string;
  created_at: string;
}

// ── Batch response types (eliminate N+1 queries) ──

export interface RFQBatchResponse {
  items: Record<string, RFQ>;
}

export interface ProductsBatchResponse {
  items: Record<string, Product[]>;
}

// ═══════════════════════════════════════════════════════════
// RFQ Matching Types
// ═══════════════════════════════════════════════════════════

export interface RFQMatch {
  id: string;
  rfq_id: string;
  supplier_id: string;
  match_score: number;
  match_reason?: string;
  response_deadline?: string | null;
  responded_at?: string | null;
  status: "pending" | "responded" | "expired" | "declined";
  created_at: string;
}

export interface RFQMatchListResponse {
  items: RFQMatch[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ClaimMatchRequest {
  action: "respond" | "decline";
}
