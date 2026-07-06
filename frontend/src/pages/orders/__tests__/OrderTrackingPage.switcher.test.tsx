import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrderTrackingPage } from "../OrderTrackingPage";
import { quotationService } from "@/services/quotationService";
import { orderTrackingService } from "@/services/orderTrackingService";
import { useAuthStore } from "@/stores/authStore";
import type { Quotation } from "@/types/quotes";
import type { TrackingStatusResponse } from "@/types/orders";

vi.mock("@/services/quotationService");
vi.mock("@/services/orderTrackingService");

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

const QUOTE: Quotation = {
  id: "q-1",
  rfq_id: "rfq-1",
  agent_id: "agent-1",
  quotation_number: "Q-2026-001",
  status: "accepted",
  target_currency: "USD",
  exchange_rate_used: 0.14,
  subtotal: 1000,
  grand_total: 1200,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const TRACKING: TrackingStatusResponse = {
  quotation_id: "q-1",
  quotation_number: "Q-2026-001",
  current_status: "sea_freight",
  events: [],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/orders/q-1/tracking"]}>
        <Routes>
          <Route path="/orders/:id/tracking" element={<OrderTrackingPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("OrderTrackingPage switcher", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ user: null, role: null });
  });

  it("renders the two-column desktop layout at >=1024px", async () => {
    useAuthStore.setState({ role: "client", user: { id: "u1", email: "c@example.com", full_name: "Ali", role: "client", phone: null, is_active: true, created_at: "" } as any });
    vi.mocked(quotationService.get).mockResolvedValue(QUOTE);
    vi.mocked(orderTrackingService.getTracking).mockResolvedValue(TRACKING);
    mockMatchMedia(true);
    const { container } = renderPage();

    await screen.findByText("مراحل الشحنة");
    expect(container.querySelector('[class*="grid-cols-[1fr_300px]"]')).toBeInTheDocument();
  });

  it("renders the stacked single-column mobile layout below 1024px", async () => {
    useAuthStore.setState({ role: "client", user: { id: "u1", email: "c@example.com", full_name: "Ali", role: "client", phone: null, is_active: true, created_at: "" } as any });
    vi.mocked(quotationService.get).mockResolvedValue(QUOTE);
    vi.mocked(orderTrackingService.getTracking).mockResolvedValue(TRACKING);
    mockMatchMedia(false);
    const { container } = renderPage();

    await screen.findByText("مراحل الشحنة");
    expect(container.querySelector('[class*="grid-cols-[1fr_300px]"]')).not.toBeInTheDocument();
  });
});
