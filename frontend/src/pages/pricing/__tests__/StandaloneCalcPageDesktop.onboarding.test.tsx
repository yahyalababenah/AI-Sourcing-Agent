import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/renderWithProviders";
import { StandaloneCalcPageDesktop } from "../StandaloneCalcPageDesktop";

vi.mock("@/services/pricingService");
vi.mock("@/services/quotationService");

// The interactive onboarding tour's guided walkthrough anchors to these
// data-tour ids (see constants/onboardingSteps.ts's agent-calculator-*
// mini-walkthrough) — a renamed/removed attribute here would silently
// break the "complete your first calculation" tour steps without any
// type error to catch it.
describe("StandaloneCalcPageDesktop — onboarding tour anchors", () => {
  it("marks the first product row's quantity and unit price fields, the calculate button, and the result area", () => {
    const { container } = renderWithProviders(<StandaloneCalcPageDesktop />);

    expect(container.querySelector('[data-tour="tour-calc-quantity"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="tour-calc-price"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="tour-calc-button"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="tour-calc-result"]')).toBeInTheDocument();
  });
});
