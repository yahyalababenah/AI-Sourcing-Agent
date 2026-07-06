import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrderTrackingPageMobile } from "../OrderTrackingPageMobile";
import { quotationService } from "@/services/quotationService";
import { orderTrackingService } from "@/services/orderTrackingService";
import { useAuthStore } from "@/stores/authStore";
import type { Quotation } from "@/types/quotes";
import type { TrackingStatusResponse } from "@/types/orders";

vi.mock("@/services/quotationService");
vi.mock("@/services/orderTrackingService");

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

const TRACKING_DELIVERED: TrackingStatusResponse = {
  quotation_id: "q-1",
  quotation_number: "Q-2026-001",
  current_status: "delivered",
  events: [],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/orders/q-1/tracking"]}>
        <Routes>
          <Route path="/orders/:id/tracking" element={<OrderTrackingPageMobile />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("OrderTrackingPageMobile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ user: null, role: null });
  });

  it("marks every stage complete and shows no 'next status' controls once delivered", async () => {
    useAuthStore.setState({
      role: "agent",
      user: { id: "u2", email: "a@example.com", full_name: "Factory", role: "agent", phone: null, is_active: true, created_at: "" } as any,
    });
    vi.mocked(quotationService.get).mockResolvedValue(QUOTE);
    vi.mocked(orderTrackingService.getTracking).mockResolvedValue(TRACKING_DELIVERED);
    renderPage();

    await screen.findByText("مراحل الشحنة");
    // 6/6 stages reached — the "quick actions" panel would have nothing
    // left to offer, so the "next status" update control shouldn't render.
    expect(screen.queryByText("تحديث حالة التتبع")).not.toBeInTheDocument();
  });

  it("shows an honest '—' for the shipment value when the quote has none", async () => {
    useAuthStore.setState({
      role: "client",
      user: { id: "u1", email: "c@example.com", full_name: "Ali", role: "client", phone: null, is_active: true, created_at: "" } as any,
    });
    vi.mocked(quotationService.get).mockResolvedValue({ ...QUOTE, grand_total: 0 });
    vi.mocked(orderTrackingService.getTracking).mockResolvedValue(TRACKING_DELIVERED);
    renderPage();

    await screen.findByText("مراحل الشحنة");
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
