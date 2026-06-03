export interface PricingRuleCreate {
  name: string;
  description?: string;
  category: string;
  rule_type: "percentage" | "fixed" | "formula";
  value: number;
  currency?: string;
  conditions?: Record<string, unknown>;
  priority: number;
  is_active?: boolean;
}

export interface PricingRule {
  id: string;
  name: string;
  description?: string;
  category: string;
  rule_type: string;
  value: number;
  currency?: string;
  conditions?: Record<string, unknown>;
  priority: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PricingRuleListResponse {
  items: PricingRule[];
  total: number;
}

export interface PriceProductInput {
  product_id: string;
  name: string;
  quantity: number;
  unit_price_cny: number;
}

export interface CalculatePriceRequest {
  rfq_id: string;
  target_currency: string;
  destination_port: string;
  products: PriceProductInput[];
}

export interface LineItemResult {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_cny: number;
  exchange_rate: number;
  unit_price_converted: number;
  freight_cost: number;
  customs_duty: number;
  clearance_fee: number;
  commission: number;
  subtotal: number;
  discount: number;
  total: number;
}

export interface CalculatePriceResponse {
  rfq_id: string;
  target_currency: string;
  exchange_rate_used: number;
  line_items: LineItemResult[];
  subtotal_before_vat: number;
  vat: number;
  early_payment_discount: number;
  grand_total: number;
  discount_total: number;
  rules_applied: string[];
}
