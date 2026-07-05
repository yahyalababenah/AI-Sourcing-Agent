import { describe, expect, it, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { QuotationListPageMobile } from "../QuotationListPageMobile";
import { quotationService } from "@/services/quotationService";
import type { Quotation, QuotationListResponse } from "@/types/quotes";

vi.mock("@/services/quotationService");

const ACCEPTED_QUOTE: Quotation = {
  id: "q-1",
  rfq_id: "rfq-1",
  agent_id: "agent-1",
  quotation_number: "Q-2026-003",
  status: "accepted",
  target_currency: "JOD",
  exchange_rate_used: 0.1047,
  subtotal: 500,
  grand_total: 500,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  client_name: "مستورد الأثاث",
};

describe("QuotationListPageMobile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows an honest empty state when there are no quotations", async () => {
    vi.mocked(quotationService.list).mockResolvedValue({ items: [], total: 0 });
    renderWithProviders(<QuotationListPageMobile />);

    expect(await screen.findByText("لا توجد عروض أسعار")).toBeInTheDocument();
  });

  it("stacks quotation cards with status, amount, and a tracking action for accepted quotes", async () => {
    const response: QuotationListResponse = { items: [ACCEPTED_QUOTE], total: 1 };
    vi.mocked(quotationService.list).mockResolvedValue(response);
    renderWithProviders(<QuotationListPageMobile />);

    expect(await screen.findByText("Q-2026-003")).toBeInTheDocument();
    expect(screen.getByText("مستورد الأثاث")).toBeInTheDocument();
    expect(screen.getByText("مكتمل")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🚚 تتبع" })).toBeInTheDocument();
  });
});
