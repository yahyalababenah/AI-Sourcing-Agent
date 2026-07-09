export interface QuotationLineItem {
  product_id: string;
  catalog_product_id?: string;
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
  rfq_id?: string;
  target_currency?: string;
  exchange_rate_used?: number;
  line_items: QuotationLineItem[];
  subtotal?: number;
  freight_total?: number;
  customs_total?: number;
  commission_total?: number;
  discount_total?: number;
  vat_total?: number;
  grand_total?: number;
  payment_terms?: string;
  delivery_terms?: string;
  validity_days?: number;
  notes?: string;
}

export interface Quotation {
  id: string;
  rfq_id: string;
  agent_id: string;
  quotation_number: string;
  status: string;
  target_currency: string;
  exchange_rate_used: number;
  subtotal: number;
  freight_total?: number;
  customs_total?: number;
  commission_total?: number;
  discount_total?: number;
  vat_total?: number;
  grand_total: number;
  payment_terms?: string;
  delivery_terms?: string;
  validity_days?: number;
  notes?: string;
  pdf_path?: string;
  pdf_generated_at?: string;
  line_items?: QuotationLineItem[];
  created_at: string;
  updated_at: string;
  // runtime enrichment
  client_name?: string;
  currency?: string;
}

export interface QuotationListResponse {
  items: Quotation[];
  total: number;
}

export interface QuotationGenerateRequest {
  rfq_id: string;
  target_currency?: string;
  exchange_rate_used: number;
  line_items: QuotationLineItem[];
  subtotal: number;
  freight_total?: number;
  customs_total?: number;
  commission_total?: number;
  discount_total?: number;
  vat_total?: number;
  grand_total: number;
  payment_terms?: string;
  delivery_terms?: string;
  validity_days?: number;
  notes?: string;
}

export interface QuotationGeneratePdfResponse {
  task_id: string;
  status: string;
}

export interface QuotationGenerateAcceptedResponse {
  quotation_id: string;
  task_id?: string;
  status: string;
  message: string;
  /** TEMPORARY: sync fallback for demo — set once the PDF is generated inline. */
  pdf_url?: string | null;
}
