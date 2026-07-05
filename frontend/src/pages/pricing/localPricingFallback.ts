import type { PriceProductInput, CalculatePriceResponse, LineItemResult } from "@/types/pricing";

// Rough client-side re-implementation of app/modules/pricing/engine.py's
// DEFAULTS, used only when POST /pricing/calculate is unreachable so the
// calculator still returns a number instead of just erroring. It cannot see
// the HS-code fee schedule (falls back to the engine's own general customs
// rate), MOQ/early-payment discounts, or per-shipment 301/070/018 fees — the
// result is marked is_local_fallback so the UI can flag it as approximate.
const CNY_TO_USD = 0.14;
const CNY_TO_JOD = 0.1047;
const USD_TO_JOD = CNY_TO_JOD / CNY_TO_USD;

const FREIGHT_USD_PER_CBM: Record<string, number> = { aqaba: 75, jeddah: 60 };
const FREIGHT_USD_PER_CBM_DEFAULT = 80;
const KG_PER_CBM = 500;
const MIN_CBM = 0.1;
const INSURANCE_RATE = 0.01;
const CUSTOMS_DUTY_RATE_GENERAL = 0.05;
const CLEARANCE_FEE_USD = 150;
const COMMISSION_RATE = 0.03;
const VAT_RATE = 0.16;

function exchangeRateFor(targetCurrency: string) {
  return targetCurrency === "USD" ? CNY_TO_USD : CNY_TO_JOD;
}

function usdToLocal(targetCurrency: string) {
  return targetCurrency === "USD" ? 1 : USD_TO_JOD;
}

function freightRateUsd(destinationPort: string) {
  const port = destinationPort.toLowerCase();
  const match = Object.keys(FREIGHT_USD_PER_CBM).find((key) => port.includes(key));
  return match ? FREIGHT_USD_PER_CBM[match] : FREIGHT_USD_PER_CBM_DEFAULT;
}

export function calculateLocalFallback(
  products: PriceProductInput[],
  targetCurrency: string,
  destinationPort: string,
  rfqId: string,
): CalculatePriceResponse {
  const exchangeRate = exchangeRateFor(targetCurrency);
  const toLocal = usdToLocal(targetCurrency);
  const freightRate = freightRateUsd(destinationPort);
  const clearanceFeeLocal = CLEARANCE_FEE_USD * toLocal;

  const lineItems: LineItemResult[] = products.map((p) => {
    const unitPriceConverted = p.unit_price_cny * exchangeRate;
    const fobTotal = unitPriceConverted * p.quantity;

    const totalWeightKg = (p.weight_kg ?? 0) * p.quantity;
    const volumeCbm = totalWeightKg > 0 ? totalWeightKg / KG_PER_CBM : MIN_CBM;
    const freightTotal = freightRate * volumeCbm * toLocal;

    const insuranceTotal = (fobTotal + freightTotal) * INSURANCE_RATE;
    const cifTotal = fobTotal + freightTotal + insuranceTotal;
    const customsDuty = cifTotal * CUSTOMS_DUTY_RATE_GENERAL;

    const commissionBase = fobTotal + freightTotal + customsDuty + clearanceFeeLocal;
    const commission = commissionBase * COMMISSION_RATE;

    const subtotal = fobTotal + freightTotal + insuranceTotal + customsDuty + clearanceFeeLocal + commission;

    return {
      product_id: p.product_id,
      product_name: p.name,
      quantity: p.quantity,
      unit_price_cny: p.unit_price_cny,
      exchange_rate: exchangeRate,
      unit_price_converted: unitPriceConverted,
      freight_cost: freightTotal,
      insurance_cost: insuranceTotal,
      cif_value: cifTotal,
      customs_duty: customsDuty,
      clearance_fee: clearanceFeeLocal,
      commission,
      subtotal,
      discount: 0,
      total: subtotal,
      service_flat_301: 0,
      service_percent_070: 0,
      penalty_018: 0,
      hs_code_matched: false,
    };
  });

  const subtotalBeforeVat = lineItems.reduce((acc, li) => acc + li.total, 0);
  const vat = subtotalBeforeVat * VAT_RATE;
  const grandTotal = subtotalBeforeVat + vat;

  return {
    rfq_id: rfqId,
    target_currency: targetCurrency,
    exchange_rate_used: exchangeRate,
    line_items: lineItems,
    subtotal_before_vat: subtotalBeforeVat,
    vat,
    early_payment_discount: 0,
    grand_total: grandTotal,
    discount_total: 0,
    rules_applied: ["local_fallback: تقدير تقريبي دون اتصال بالخادم (جمارك عامة 5٪، عمولة 3٪، ضريبة 16٪)"],
    service_flat_fee_301_total: 0,
    custom_fees_total: 0,
    custom_rules_applied: [],
    is_local_fallback: true,
  };
}
