import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/renderWithProviders";
import { StandaloneCalcPageMobile } from "../StandaloneCalcPageMobile";

vi.mock("@/services/pricingService");
vi.mock("@/services/quotationService");

// See StandaloneCalcPageDesktop.onboarding.test.tsx — same contract, mobile layout.
describe("StandaloneCalcPageMobile — onboarding tour anchors", () => {
  it("marks the first product row's quantity and unit price fields, and the calculate button", () => {
    const { container } = renderWithProviders(<StandaloneCalcPageMobile />);

    expect(container.querySelector('[data-tour="tour-calc-quantity"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="tour-calc-price"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="tour-calc-button"]')).toBeInTheDocument();
  });
});
