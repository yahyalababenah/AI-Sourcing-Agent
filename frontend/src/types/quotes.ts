export interface QuotationLineItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_cny: number;
  unit_price_converted: number;
  exchange_rate: number;
  freight_cost: number;
  customs_duty: number;
  commission: number;
  subtotal: number;
  discount: number;
  total: number;
}

export interface QuotationCreate {
  rfq_id: string;
  line_items: QuotationLineItem[];
  valid_until?: string;
  notes?: string;
}

export interface Quotation {
  id: string;
  quotation_number: string;
  rfq_id: string;
  client_name: string;
  status: string;
  line_items: QuotationLineItem[];
  total_cny: number;
  total_converted: number;
  grand_total: number;
  currency: string;
  exchange_rate: number;
  valid_until?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface QuotationListResponse {
  items: Quotation[];
  total: number;
  page: number;
  limit: number;
}

export interface QuotationGenerateRequest {
  rfq_ids: string[];
}

export interface QuotationGeneratePdfResponse {
  task_id: string;
  status: string;
}

export interface QuotationGenerateAcceptedResponse {
  task_id: string;
  status: string;
  message: string;
}
