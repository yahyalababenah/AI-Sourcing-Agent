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
  extracted_entities?: Record<string, string>;
  destination_port?: string;
  target_currency?: string;
}

export interface RFQ {
  id: string;
  client_name: string;
  client_phone?: string;
  client_request_arabic: string;
  translated_query_chinese?: string;
  extracted_entities?: Record<string, string>;
  destination_port?: string;
  target_currency: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
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
  status: string;
  created_at: string;
}
