import { describe, expect, it, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { PricingCalcPage } from "../PricingCalcPage";
import { intakeService } from "@/services/intakeService";
import type { RFQListResponse } from "@/types/intake";

vi.mock("@/services/intakeService");
vi.mock("@/services/pricingService");
vi.mock("@/services/quotationService");

function mockMatchMedia(matchesDesktop: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: query.includes("1024") ? matchesDesktop : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const RFQ_LIST: RFQListResponse = { items: [], total: 0, page: 1, page_size: 100 };

describe("PricingCalcPage switcher", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the desktop two-column sticky layout at >=1024px", async () => {
    vi.mocked(intakeService.list).mockResolvedValue(RFQ_LIST);
    mockMatchMedia(true);
    const { container } = renderWithProviders(<PricingCalcPage />);
    await screen.findByText("بيانات الشحنة");
    // Desktop-only: wide form column + sticky 380px result column.
    expect(container.querySelector('[class*="lg:grid-cols-"]')).toBeInTheDocument();
  });

  it("renders the mobile stacked layout below 1024px", async () => {
    vi.mocked(intakeService.list).mockResolvedValue(RFQ_LIST);
    mockMatchMedia(false);
    const { container } = renderWithProviders(<PricingCalcPage />);
    // Mobile shares the same restyled "بيانات الشحنة" card heading now
    // (T5.2), but stacks form/result in a single column with no grid split.
    await screen.findByText("بيانات الشحنة");
    expect(container.querySelector('[class*="lg:grid-cols-"]')).not.toBeInTheDocument();
  });
});
