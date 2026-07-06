import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrderTrackingPageDesktop } from "../OrderTrackingPageDesktop";
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

const TRACKING: TrackingStatusResponse = {
  quotation_id: "q-1",
  quotation_number: "Q-2026-001",
  current_status: "sea_freight",
  events: [{ id: "ev-1", quotation_id: "q-1", from_status: "production", to_status: "sea_freight", notes: null, changed_by_id: null, created_at: "2026-01-05T00:00:00Z" }],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/orders/q-1/tracking"]}>
        <Routes>
          <Route path="/orders/:id/tracking" element={<OrderTrackingPageDesktop />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("OrderTrackingPageDesktop", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ user: null, role: null });
  });

  it("highlights the real current stage without fabricating a completion percentage or delivery ETA", async () => {
    useAuthStore.setState({ role: "client", user: { id: "u1", email: "c@example.com", full_name: "Ali", role: "client", phone: null, is_active: true, created_at: "" } as any });
    vi.mocked(quotationService.get).mockResolvedValue(QUOTE);
    vi.mocked(orderTrackingService.getTracking).mockResolvedValue(TRACKING);
    renderPage();

    expect(await screen.findByText("جارٍ الآن")).toBeInTheDocument();
    expect(screen.getAllByText("الشحن البحري").length).toBeGreaterThan(0);
    // No fabricated per-stage completion percentage or fake delivery date.
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText("أغسطس")).not.toBeInTheDocument();
    expect(screen.queryByText("التسليم المتوقع")).not.toBeInTheDocument();
  });

  it("shows the real event history entry", async () => {
    useAuthStore.setState({ role: "client", user: { id: "u1", email: "c@example.com", full_name: "Ali", role: "client", phone: null, is_active: true, created_at: "" } as any });
    vi.mocked(quotationService.get).mockResolvedValue(QUOTE);
    vi.mocked(orderTrackingService.getTracking).mockResolvedValue(TRACKING);
    renderPage();

    await screen.findByText("سجل التحديثات");
    expect(screen.getAllByText("قيد التصنيع").length).toBeGreaterThan(0);
  });

  it("shows the status-update panel only for agent/admin roles", async () => {
    useAuthStore.setState({ role: "agent", user: { id: "u2", email: "a@example.com", full_name: "Factory", role: "agent", phone: null, is_active: true, created_at: "" } as any });
    vi.mocked(quotationService.get).mockResolvedValue(QUOTE);
    vi.mocked(orderTrackingService.getTracking).mockResolvedValue(TRACKING);
    renderPage();

    expect(await screen.findByText("تحديث حالة التتبع")).toBeInTheDocument();
  });

  it("hides the status-update panel for a client viewer", async () => {
    useAuthStore.setState({ role: "client", user: { id: "u1", email: "c@example.com", full_name: "Ali", role: "client", phone: null, is_active: true, created_at: "" } as any });
    vi.mocked(quotationService.get).mockResolvedValue(QUOTE);
    vi.mocked(orderTrackingService.getTracking).mockResolvedValue(TRACKING);
    renderPage();

    await screen.findByText("مراحل الشحنة");
    expect(screen.queryByText("تحديث حالة التتبع")).not.toBeInTheDocument();
  });
});
