export interface PricingRuleCreate {
  name: string;
  description?: string;
  category: string;
  rule_type: "percentage" | "fixed" | "formula";
  value: number;
  /** Expression evaluated per line item, used only when rule_type === "formula". */
  formula?: string | null;
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
  formula?: string | null;
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
  /** Per-HS VAT override, percent; null/undefined = global default (16%). */
  vat_rate_020?: number | null;
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
  vat_rate_020?: number | null;
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
  /** Explicit CBM volume from packing list; overrides weight-based estimate if provided. */
  volume_cbm?: number;
}

export interface CalculatePriceRequest {
  rfq_id?: string;
  target_currency: string;
  destination_port: string;
  products: PriceProductInput[];
  /** Global license flag — overridden by per-product has_license if set. */
  has_license?: boolean;
  /** Global CBM volume — overridden by per-product volume_cbm if provided. */
  volume_cbm?: number;
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

export interface AppliedCustomRule {
  name: string;
  rule_type: string;
  amount: number;
}

/** Per-line-item 3-phase JCAP customs breakdown. */
export interface PhaseBreakdown {
  product_id: string;
  /** Phase 1: Base customs duty (duty_rate_001 applied to CIF value). */
  phase_1_duty: number;
  /** Phase 2: Service fees (service_flat_fee_301 + service_percent_070 on CIF). */
  phase_2_service: number;
  /** Phase 3: VAT + penalty (VAT on CIF+duty + conditional penalty_rate_018). */
  phase_3_vat_penalty: number;
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
  /** 301 is a per-shipment fee (charged once, not per line item) — see PricingCalcPage. */
  service_flat_fee_301_total: number;
  custom_fees_total: number;
  custom_rules_applied: AppliedCustomRule[];
  /** Whether this calculation used JCAP-simulated rates. */
  is_jcap_simulated: boolean;
  /** Per-line-item 3-phase breakdown (JCAP compliance detail). */
  three_phase_breakdown?: PhaseBreakdown[];
  /** Set only by the frontend's local fallback (see localPricingFallback.ts)
   * when POST /pricing/calculate fails — never sent by the real backend. */
  is_local_fallback?: boolean;
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
