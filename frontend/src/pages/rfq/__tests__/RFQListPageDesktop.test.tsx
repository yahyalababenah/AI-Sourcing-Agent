import { describe, expect, it, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { RFQListPageDesktop } from "../RFQListPageDesktop";
import { intakeService } from "@/services/intakeService";
import { quotationService } from "@/services/quotationService";
import type { RFQ, RFQListResponse } from "@/types/intake";
import type { Quotation, QuotationListResponse } from "@/types/quotes";

vi.mock("@/services/intakeService");
vi.mock("@/services/quotationService");

const RFQ_QUOTED: RFQ = {
  id: "rfq-1",
  client_name: "أحمد",
  client_request_arabic: "نحتاج 300 كرسي مكتب مريح لصالة اجتماعات",
  destination_port: "Aqaba",
  target_currency: "USD",
  status: "quoted",
  is_public: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const RFQ_OPEN: RFQ = {
  ...RFQ_QUOTED,
  id: "rfq-2",
  status: "open",
  client_request_arabic: "500 كشاف إضاءة LED",
};

const QUOTE_FOR_RFQ1: Quotation = {
  id: "q-1",
  rfq_id: "rfq-1",
  agent_id: "agent-1",
  quotation_number: "Q-001",
  status: "sent",
  target_currency: "USD",
  exchange_rate_used: 0.14,
  subtotal: 1000,
  grand_total: 1500,
  created_at: "2026-01-02T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
};

describe("RFQListPageDesktop", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows an honest empty state with no RFQs", async () => {
    vi.mocked(intakeService.list).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 10 });
    renderWithProviders(<RFQListPageDesktop />);

    expect(await screen.findByText("لا توجد طلبات عروض")).toBeInTheDocument();
  });

  it("shows the latest quote value next to a quoted RFQ, and an honest dash before one arrives", async () => {
    const rfqsResponse: RFQListResponse = { items: [RFQ_QUOTED, RFQ_OPEN], total: 2, page: 1, page_size: 10 };
    const quotesResponse: QuotationListResponse = { items: [QUOTE_FOR_RFQ1], total: 1 };
    vi.mocked(intakeService.list).mockResolvedValue(rfqsResponse);
    vi.mocked(quotationService.list).mockResolvedValue(quotesResponse);
    renderWithProviders(<RFQListPageDesktop />);

    expect(await screen.findByText("1,500 USD")).toBeInTheDocument();
    // StatusPill mapping: quoted → negotiating, open → pending.
    expect(screen.getByText("جارٍ التفاوض")).toBeInTheDocument();
    expect(screen.getByText("قيد الانتظار")).toBeInTheDocument();
    // The open RFQ has no quote yet — honest dash, not a fabricated value.
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThan(0);
  });

  it("filters by status", async () => {
    vi.mocked(intakeService.list).mockResolvedValue({ items: [RFQ_QUOTED], total: 1, page: 1, page_size: 10 });
    vi.mocked(quotationService.list).mockResolvedValue({ items: [], total: 0 });
    const user = userEvent.setup();
    renderWithProviders(<RFQListPageDesktop />);

    await screen.findByText("نحتاج 300 كرسي مكتب مريح لصالة اجتماعات");
    await user.click(screen.getByText("مغلق"));

    expect(intakeService.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: "closed", page: 1 }),
    );
  });
});
