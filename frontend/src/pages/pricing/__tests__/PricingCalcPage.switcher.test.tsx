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

  it("renders the desktop card layout at >=1024px", async () => {
    vi.mocked(intakeService.list).mockResolvedValue(RFQ_LIST);
    mockMatchMedia(true);
    renderWithProviders(<PricingCalcPage />);
    // Desktop uses the restyled "بيانات الشحنة" card heading.
    expect(await screen.findByText("بيانات الشحنة")).toBeInTheDocument();
  });

  it("renders the mobile step layout below 1024px", async () => {
    vi.mocked(intakeService.list).mockResolvedValue(RFQ_LIST);
    mockMatchMedia(false);
    renderWithProviders(<PricingCalcPage />);
    // Mobile (unchanged legacy layout) uses the numbered step heading.
    expect(await screen.findByText("١. اختيار طلب عرض السعر")).toBeInTheDocument();
  });
});
