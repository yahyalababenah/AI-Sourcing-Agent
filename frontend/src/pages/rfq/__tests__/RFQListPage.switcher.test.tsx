import { describe, expect, it, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { RFQListPage } from "../RFQListPage";
import { intakeService } from "@/services/intakeService";
import { quotationService } from "@/services/quotationService";
import { useAuthStore } from "@/stores/authStore";
import type { RFQListResponse } from "@/types/intake";
import type { QuotationListResponse } from "@/types/quotes";

vi.mock("@/services/intakeService");
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

const EMPTY_RFQS: RFQListResponse = { items: [], total: 0, page: 1, page_size: 10 };
const EMPTY_QUOTES: QuotationListResponse = { items: [], total: 0 };

describe("RFQListPage switcher", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ user: null, role: null });
  });

  it("shows the rebuilt 'طلباتي' desktop table for a client role at >=1024px", async () => {
    useAuthStore.setState({ role: "client" });
    vi.mocked(intakeService.list).mockResolvedValue(EMPTY_RFQS);
    vi.mocked(quotationService.list).mockResolvedValue(EMPTY_QUOTES);
    mockMatchMedia(true);
    renderWithProviders(<RFQListPage />);

    expect(await screen.findByText("طلباتي")).toBeInTheDocument();
  });

  it("shows the rebuilt mobile list for a client role below 1024px", async () => {
    useAuthStore.setState({ role: "client" });
    vi.mocked(intakeService.list).mockResolvedValue(EMPTY_RFQS);
    vi.mocked(quotationService.list).mockResolvedValue(EMPTY_QUOTES);
    mockMatchMedia(false);
    renderWithProviders(<RFQListPage />);

    expect(await screen.findByText("طلباتي")).toBeInTheDocument();
  });

  it("keeps the legacy 'طلبات العروض' table for a non-client role", async () => {
    useAuthStore.setState({ role: "agent" });
    vi.mocked(intakeService.list).mockResolvedValue(EMPTY_RFQS);
    mockMatchMedia(true);
    renderWithProviders(<RFQListPage />);

    expect(await screen.findByText("طلبات العروض")).toBeInTheDocument();
    expect(screen.queryByText("طلباتي")).not.toBeInTheDocument();
  });
});
