import { describe, expect, it, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SupplierRfqInbox } from "../SupplierRfqInbox";
import { intakeService } from "@/services/intakeService";
import type { RFQMatchListResponse, RFQListResponse, ProductsBatchResponse } from "@/types/intake";

vi.mock("@/services/intakeService");

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

const EMPTY_MATCHES: RFQMatchListResponse = { items: [], total: 0, page: 1, page_size: 50, total_pages: 0 };
const EMPTY_PUBLIC: RFQListResponse = { items: [], total: 0, page: 1, page_size: 50 };
const EMPTY_PRODUCTS: ProductsBatchResponse = { items: {} };

describe("SupplierRfqInbox switcher", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the desktop grid layout at >=1024px", async () => {
    vi.mocked(intakeService.listMatched).mockResolvedValue(EMPTY_MATCHES);
    vi.mocked(intakeService.listPublic).mockResolvedValue(EMPTY_PUBLIC);
    vi.mocked(intakeService.listProductsBatch).mockResolvedValue(EMPTY_PRODUCTS);
    mockMatchMedia(true);
    renderWithProviders(<SupplierRfqInbox />);

    await screen.findByText("صندوق وارد طلبات التسعير");
    // Desktop-only full tab label ("المباريات الحصرية") vs mobile's
    // condensed "الحصرية".
    expect(screen.getByText("المباريات الحصرية")).toBeInTheDocument();
  });

  it("renders the mobile stacked layout below 1024px", async () => {
    vi.mocked(intakeService.listMatched).mockResolvedValue(EMPTY_MATCHES);
    vi.mocked(intakeService.listPublic).mockResolvedValue(EMPTY_PUBLIC);
    vi.mocked(intakeService.listProductsBatch).mockResolvedValue(EMPTY_PRODUCTS);
    mockMatchMedia(false);
    renderWithProviders(<SupplierRfqInbox />);

    await screen.findByText("صندوق وارد طلبات التسعير");
    // Mobile-only condensed tab label ("الحصرية") vs desktop's full
    // "المباريات الحصرية".
    expect(screen.getByText("الحصرية")).toBeInTheDocument();
  });
});
