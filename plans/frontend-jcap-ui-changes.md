# Frontend UI Changes for JCAP 3-Phase Pricing Breakdown

## Overview

The backend now returns `is_jcap_simulated` and `three_phase_breakdown` in `CalculatePriceResponse`. The frontend needs UI updates to display this information.

## Components to Update

### 1. `PricingResultCard.tsx` — Add JCAP badge & phase summary

**File:** [`frontend/src/pages/pricing/PricingResultCard.tsx`](frontend/src/pages/pricing/PricingResultCard.tsx)

**Changes needed:**

a) **Show JCAP-simulated badge** when `result.is_jcap_simulated === true`:
```tsx
{result.is_jcap_simulated && (
  <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
    🔬 JCAP محاكي
  </span>
)}
```
Place it next to the existing accuracy badge in the header.

b) **Add a collapsible "تفاصيل المراحل الثلاث" (3-Phase Details) section** after the LineRow entries, before the grand total:

```tsx
{result.three_phase_breakdown && result.three_phase_breakdown.length > 0 && (
  <details className="mt-3">
    <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
      🔬 تفاصيل المراحل الثلاث (JCAP)
    </summary>
    <div className="mt-2 space-y-1 rounded-lg bg-slate-50 p-3">
      {result.three_phase_breakdown.map((phase, i) => (
        <div key={i} className="text-xs text-slate-600">
          <span className="font-medium text-slate-700">{result.line_items[i]?.product_name ?? `منتج ${i + 1}`}</span>
          <div className="mr-4 grid grid-cols-3 gap-2 tabular-nums" dir="ltr">
            <span>المرحلة 1 (الرسوم): {fmt(phase.phase_1_duty)}</span>
            <span>المرحلة 2 (الخدمات): {fmt(phase.phase_2_service)}</span>
            <span>المرحلة 3 (ضريبة+غرامة): {fmt(phase.phase_3_vat_penalty)}</span>
          </div>
        </div>
      ))}
    </div>
  </details>
)}
```

### 2. `PricingDetailBreakdown.tsx` — Add JCAP columns per line

**File:** [`frontend/src/pages/pricing/PricingDetailBreakdown.tsx`](frontend/src/pages/pricing/PricingDetailBreakdown.tsx)

**Changes needed:**

a) **Add "JCAP" badge** when `result.is_jcap_simulated` at the top of the card.

b) **Add JCAP breakdown columns** (if any line has breakdown data):
- "المرحلة 1" col — `phase_1_duty`
- "المرحلة 2" col — `phase_2_service`
- "المرحلة 3" col — `phase_3_vat_penalty`

These should be conditionally rendered (only when `three_phase_breakdown` exists).

### 3. `QuoteBuilderPage.tsx` — No changes needed

**File:** [`frontend/src/pages/rfq/QuoteBuilderPage.tsx`](frontend/src/pages/rfq/QuoteBuilderPage.tsx)

The `QuoteBuilderPage` already uses `CalculatePriceResponse` and only reads `line_items`, `grand_total`, etc. The new fields (`is_jcap_simulated`, `three_phase_breakdown`) are optional and will be ignored. No changes needed here unless a JCAP badge is desired on the quote preview.

### 4. `RFQEstimatePreview.tsx` — No changes needed

**File:** [`frontend/src/pages/rfq/RFQEstimatePreview.tsx`](frontend/src/pages/rfq/RFQEstimatePreview.tsx)

This component only renders local fallback estimates, which won't have `three_phase_breakdown`. No changes needed.

### 5. License Toggle & Volume CBM Input

**File:** [`frontend/src/pages/pricing/usePricingCalculator.ts`](frontend/src/pages/pricing/usePricingCalculator.ts) — Already updated.

**UI components that render product input rows:**

a) **ProductsInputTable.tsx** — Add a CBM column/input field for `volume_cbm` per product.
b) **PricingCalcPageDesktop.tsx** / **PricingCalcPageMobile.tsx** — Add:
   - A "ترخيص استيراد" (Import License) toggle at the shipment level that sets `has_license` globally.
   - A "حجم الشحنة (CBM)" (Volume CBM) input field at the shipment level.

These inputs should feed into `usePricingCalculator`'s state and be passed through in the `calculateMutation`.

### 6. `MarketplaceRfqModal.tsx` — Add license toggle

**File:** [`frontend/src/pages/catalog/MarketplaceRfqModal.tsx`](frontend/src/pages/catalog/MarketplaceRfqModal.tsx)

The marketplace RFQ modal already passes `has_license` to `pricingService.estimate`. Add a toggle in the modal form so users can indicate whether they have the required license.

## Implementation Order

1. `ProductsInputTable.tsx` — Add `volume_cbm` input column
2. `PricingCalcPageDesktop.tsx` / `PricingCalcPageMobile.tsx` — Add license toggle + CBM input at shipment level
3. `PricingResultCard.tsx` — Add JCAP badge + collapsible 3-phase breakdown
4. `PricingDetailBreakdown.tsx` — Add JCAP columns to table
5. `MarketplaceRfqModal.tsx` — Add license toggle
