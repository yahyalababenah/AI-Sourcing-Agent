import { api } from "@/lib/api";
import { API } from "@/constants/api";
import type {
  PricingRule,
  PricingRuleCreate,
  PricingRuleListResponse,
  HSCodeFeeSchedule,
  HSCodeFeeScheduleCreate,
  HSCodeFeeScheduleListResponse,
  CalculatePriceRequest,
  CalculatePriceResponse,
  QuickEstimateResponse,
} from "@/types/pricing";

export const pricingService = {
  /** List pricing rules. */
  listRules: (params?: { category?: string; active_only?: boolean }) =>
    api.get<PricingRuleListResponse>(API.PRICING.RULES, { params }).then((r) => r.data),

  /** Get a single pricing rule. */
  getRule: (id: string) =>
    api.get<PricingRule>(API.PRICING.RULE(id)).then((r) => r.data),

  /** Create a new pricing rule (admin only). */
  createRule: (data: PricingRuleCreate) =>
    api.post<PricingRule>(API.PRICING.RULES, data).then((r) => r.data),

  /** Update a pricing rule (admin only). */
  updateRule: (id: string, data: PricingRuleCreate) =>
    api.put<PricingRule>(API.PRICING.RULE(id), data).then((r) => r.data),

  /** Delete a pricing rule (admin only). */
  deleteRule: (id: string) =>
    api.delete(API.PRICING.RULE(id)).then((r) => r.data),

  /** List HS-Code fee schedules. */
  listHsCodes: () =>
    api.get<HSCodeFeeScheduleListResponse>(API.PRICING.HS_CODES).then((r) => r.data),

  /** Create a new HS-Code fee schedule (admin only). */
  createHsCode: (data: HSCodeFeeScheduleCreate) =>
    api.post<HSCodeFeeSchedule>(API.PRICING.HS_CODES, data).then((r) => r.data),

  /** Update an HS-Code fee schedule (admin only). */
  updateHsCode: (code: string, data: HSCodeFeeScheduleCreate) =>
    api.put<HSCodeFeeSchedule>(API.PRICING.HS_CODE(code), data).then((r) => r.data),

  /** Delete an HS-Code fee schedule (admin only). */
  deleteHsCode: (code: string) =>
    api.delete(API.PRICING.HS_CODE(code)).then((r) => r.data),

  /** Calculate pricing for an RFQ. */
  calculate: (data: CalculatePriceRequest) =>
    api.post<CalculatePriceResponse>(API.PRICING.CALCULATE, data).then((r) => r.data),

  /** Standalone pricing calculation — no RFQ required. */
  calculateStandalone: (data: CalculatePriceRequest) =>
    api.post<CalculatePriceResponse>(API.PRICING.CALCULATE_STANDALONE, data).then((r) => r.data),

  /** Quick landed-cost estimate for marketplace browsing (all users). */
  estimate: (data: { unit_price_cny: number; quantity: number; destination_port?: string; target_currency?: string; weight_kg?: number; hs_code?: string; has_license?: boolean; volume_cbm?: number }) =>
    api.post<QuickEstimateResponse>(API.PRICING.ESTIMATE, data).then((r) => r.data),

  /** Refresh exchange rates (admin only). */
  refreshRates: () =>
    api.post<{ status: string; rates: unknown }>(API.PRICING.REFRESH_RATES).then((r) => r.data),
};
