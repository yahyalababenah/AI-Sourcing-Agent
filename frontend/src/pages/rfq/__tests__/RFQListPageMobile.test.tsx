import { describe, expect, it, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { RFQListPageMobile } from "../RFQListPageMobile";
import { intakeService } from "@/services/intakeService";
import { quotationService } from "@/services/quotationService";
import type { RFQ, RFQListResponse } from "@/types/intake";
import type { Quotation } from "@/types/quotes";

vi.mock("@/services/intakeService");
vi.mock("@/services/quotationService");

const RFQ_CLOSED: RFQ = {
  id: "rfq-1",
  client_name: "أحمد",
  client_request_arabic: "200 طاولة مكتب",
  destination_port: "Aqaba",
  target_currency: "USD",
  status: "closed",
  is_public: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const QUOTE: Quotation = {
  id: "q-1",
  rfq_id: "rfq-1",
  agent_id: "agent-1",
  quotation_number: "Q-001",
  status: "accepted",
  target_currency: "JOD",
  exchange_rate_used: 0.1047,
  subtotal: 700,
  grand_total: 700,
  created_at: "2026-01-02T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
};

describe("RFQListPageMobile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows an honest empty state with no RFQs", async () => {
    vi.mocked(intakeService.list).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 });
    renderWithProviders(<RFQListPageMobile />);

    expect(await screen.findByText("لا توجد طلبات عروض")).toBeInTheDocument();
  });

  it("stacks a card with StatusPill status and the linked quote value", async () => {
    const rfqsResponse: RFQListResponse = { items: [RFQ_CLOSED], total: 1, page: 1, page_size: 10 };
    vi.mocked(intakeService.list).mockResolvedValue(rfqsResponse);
    vi.mocked(quotationService.list).mockResolvedValue({ items: [QUOTE], total: 1 });
    renderWithProviders(<RFQListPageMobile />);

    expect(await screen.findByText("200 طاولة مكتب")).toBeInTheDocument();
    expect(screen.getByText("مكتمل")).toBeInTheDocument();
    expect(await screen.findByText("700 JOD")).toBeInTheDocument();
  });
});
