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

export interface HSCodeFeeScheduleCreate {
  hs_code: string;
  description?: string;
  duty_rate_001: number;
  service_flat_fee_301: number;
  service_percent_070: number;
  requires_license: boolean;
  penalty_rate_018: number;
  is_verified: boolean;
  source_note?: string;
}

export interface HSCodeFeeSchedule {
  id: string;
  hs_code: string;
  description?: string;
  duty_rate_001: number;
  service_flat_fee_301: number;
  service_percent_070: number;
  requires_license: boolean;
  penalty_rate_018: number;
  is_verified: boolean;
  source_note?: string;
  created_at: string;
  updated_at: string;
}

export interface HSCodeFeeScheduleListResponse {
  items: HSCodeFeeSchedule[];
  total: number;
}

export interface PriceProductInput {
  product_id: string;
  name: string;
  quantity: number;
  unit_price_cny: number;
  /** Per-unit weight in kg — required for an accurate freight estimate (CBM). */
  weight_kg?: number;
  /** HS code for customs classification — enables the multi-item (001/301/070/018) fee schedule. */
  hs_code?: string;
  /** Whether the importer has confirmed the required license/conformity certificate for this HS code. */
  has_license?: boolean;
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
  insurance_cost: number;
  cif_value: number;
  customs_duty: number;
  clearance_fee: number;
  commission: number;
  subtotal: number;
  discount: number;
  total: number;
  service_flat_301: number;
  service_percent_070: number;
  penalty_018: number;
  hs_code_matched: boolean;
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

export interface QuickEstimateResponse {
  unit_price_cny: number;
  quantity: number;
  exchange_rate: number;
  target_currency: string;
  unit_price_converted: number;
  insurance_cost: number;
  cif_value: number;
  customs_duty: number;
  clearance_fee: number;
  subtotal_excl_shipping: number;
  vat: number;
  estimated_total: number;
  service_flat_301: number;
  service_percent_070: number;
  penalty_018: number;
  hs_code_matched: boolean;
  note: string;
}
