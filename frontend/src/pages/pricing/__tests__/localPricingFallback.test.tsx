import { describe, expect, it } from "vitest";
import { calculateLocalFallback } from "../localPricingFallback";
import type { PriceProductInput } from "@/types/pricing";

describe("calculateLocalFallback", () => {
  const product: PriceProductInput = {
    product_id: "prod-1",
    name: "Industrial LED Floodlight",
    quantity: 100,
    unit_price_cny: 50,
    weight_kg: 5,
  };

  it("flags the result as a local fallback", () => {
    const result = calculateLocalFallback([product], "JOD", "Aqaba, Jordan", "rfq-1");
    expect(result.is_local_fallback).toBe(true);
    expect(result.rfq_id).toBe("rfq-1");
  });

  it("converts CNY using the engine's default CNY→JOD rate", () => {
    const result = calculateLocalFallback([product], "JOD", "Aqaba, Jordan", "rfq-1");
    expect(result.exchange_rate_used).toBeCloseTo(0.1047, 4);
    expect(result.line_items[0].unit_price_converted).toBeCloseTo(50 * 0.1047, 4);
  });

  it("uses the Aqaba freight rate and produces a positive grand total", () => {
    const result = calculateLocalFallback([product], "JOD", "Aqaba, Jordan", "rfq-1");
    const line = result.line_items[0];
    expect(line.freight_cost).toBeGreaterThan(0);
    expect(line.customs_duty).toBeGreaterThan(0);
    expect(result.vat).toBeCloseTo(result.subtotal_before_vat * 0.16, 4);
    expect(result.grand_total).toBeCloseTo(result.subtotal_before_vat + result.vat, 4);
    expect(result.grand_total).toBeGreaterThan(0);
  });

  it("falls back to the minimum 0.1 CBM when no weight is provided", () => {
    const withoutWeight: PriceProductInput = { ...product, weight_kg: 0 };
    const withWeight = calculateLocalFallback([product], "JOD", "Aqaba, Jordan", "rfq-1");
    const withoutWeightResult = calculateLocalFallback([withoutWeight], "JOD", "Aqaba, Jordan", "rfq-1");
    // 100 units * 5kg = 500kg = exactly 1 CBM, well above the 0.1 CBM floor,
    // so removing the weight should shrink (not grow) the freight estimate.
    expect(withoutWeightResult.line_items[0].freight_cost).toBeLessThan(withWeight.line_items[0].freight_cost);
    expect(withoutWeightResult.line_items[0].freight_cost).toBeGreaterThan(0);
  });

  it("has no HS-code-dependent fees (no fee schedule available offline)", () => {
    const result = calculateLocalFallback([product], "JOD", "Aqaba, Jordan", "rfq-1");
    const line = result.line_items[0];
    expect(line.service_percent_070).toBe(0);
    expect(line.service_flat_301).toBe(0);
    expect(line.penalty_018).toBe(0);
    expect(line.hs_code_matched).toBe(false);
  });
});
