import { describe, expect, it, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { QuotationListPage } from "../QuotationListPage";
import { quotationService } from "@/services/quotationService";
import { useAuthStore } from "@/stores/authStore";
import type { QuotationListResponse } from "@/types/quotes";

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

const EMPTY: QuotationListResponse = { items: [], total: 0 };

describe("QuotationListPage switcher", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ user: null, role: null });
  });

  it("shows the rebuilt view (with a refresh control) for an agent role at >=1024px", async () => {
    useAuthStore.setState({ role: "agent" });
    vi.mocked(quotationService.list).mockResolvedValue(EMPTY);
    mockMatchMedia(true);
    renderWithProviders(<QuotationListPage />);

    await screen.findByText("عروض الأسعار");
    // Only the rebuilt Desktop/Mobile pages have a manual refresh control —
    // the legacy table never had one.
    expect(screen.getByText("تحديث")).toBeInTheDocument();
    expect(await screen.findByText("لا توجد عروض أسعار")).toBeInTheDocument();
  });

  it("shows the rebuilt mobile view (icon-only refresh) for an agent role below 1024px", async () => {
    useAuthStore.setState({ role: "agent" });
    vi.mocked(quotationService.list).mockResolvedValue(EMPTY);
    mockMatchMedia(false);
    renderWithProviders(<QuotationListPage />);

    expect(await screen.findByLabelText("تحديث")).toBeInTheDocument();
  });

  it("keeps the legacy table (no refresh control) for a non-agent role", async () => {
    useAuthStore.setState({ role: "client" });
    vi.mocked(quotationService.list).mockResolvedValue(EMPTY);
    mockMatchMedia(true);
    renderWithProviders(<QuotationListPage />);

    await screen.findByText("لا توجد عروض أسعار");
    expect(screen.queryByText("تحديث")).not.toBeInTheDocument();
  });
});
