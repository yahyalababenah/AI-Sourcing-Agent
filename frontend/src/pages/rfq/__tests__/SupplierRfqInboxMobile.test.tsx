import { describe, expect, it, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SupplierRfqInboxMobile } from "../SupplierRfqInboxMobile";
import { intakeService } from "@/services/intakeService";
import type { RFQMatchListResponse, RFQListResponse, ProductsBatchResponse, RFQBatchResponse, RFQMatch, RFQ } from "@/types/intake";

vi.mock("@/services/intakeService");

const NOW_ISO = new Date().toISOString();

const MATCH: RFQMatch = {
  id: "match-1",
  rfq_id: "rfq-1",
  supplier_id: "sup-1",
  match_score: 0.6,
  status: "pending",
  created_at: NOW_ISO,
};

const RFQ_1: RFQ = {
  id: "rfq-1",
  client_name: "مستورد الأثاث",
  client_request_arabic: "500 كرسي مكتب",
  target_currency: "USD",
  status: "open",
  is_public: false,
  created_at: NOW_ISO,
  updated_at: NOW_ISO,
};

const EMPTY_PRODUCTS: ProductsBatchResponse = { items: {} };

describe("SupplierRfqInboxMobile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stacks the exclusive-matches list in a single column with a condensed tab bar", async () => {
    const matchesResponse: RFQMatchListResponse = { items: [MATCH], total: 1, page: 1, page_size: 50, total_pages: 1 };
    const rfqBatch: RFQBatchResponse = { items: { "rfq-1": RFQ_1 } };
    vi.mocked(intakeService.listMatched).mockResolvedValue(matchesResponse);
    vi.mocked(intakeService.listPublic).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
    vi.mocked(intakeService.getBatch).mockResolvedValue(rfqBatch);
    vi.mocked(intakeService.listProductsBatch).mockResolvedValue(EMPTY_PRODUCTS);
    renderWithProviders(<SupplierRfqInboxMobile />);

    expect(await screen.findByText("مستورد الأثاث")).toBeInTheDocument();
    expect(screen.getByText("الحصرية")).toBeInTheDocument();
  });

  it("switches to the public pool tab and shows an honest empty state", async () => {
    vi.mocked(intakeService.listMatched).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50, total_pages: 0 });
    const publicResponse: RFQListResponse = { items: [], total: 0, page: 1, page_size: 50 };
    vi.mocked(intakeService.listPublic).mockResolvedValue(publicResponse);
    vi.mocked(intakeService.listProductsBatch).mockResolvedValue(EMPTY_PRODUCTS);
    const user = userEvent.setup();
    renderWithProviders(<SupplierRfqInboxMobile />);

    await user.click(screen.getByText("السوق العام"));
    expect(await screen.findByText("لا توجد طلبات في السوق العام حالياً")).toBeInTheDocument();
  });
});
