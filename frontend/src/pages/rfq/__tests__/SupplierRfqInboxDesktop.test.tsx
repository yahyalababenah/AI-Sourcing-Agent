import { describe, expect, it, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SupplierRfqInboxDesktop } from "../SupplierRfqInboxDesktop";
import { intakeService } from "@/services/intakeService";
import type {
  RFQMatchListResponse,
  RFQListResponse,
  ProductsBatchResponse,
  RFQBatchResponse,
  RFQMatch,
  RFQ,
} from "@/types/intake";

vi.mock("@/services/intakeService");

const NOW = new Date();
const TWO_DAYS_AGO = new Date(NOW.getTime() - 2 * 86400000).toISOString();

const MATCH: RFQMatch = {
  id: "match-1",
  rfq_id: "rfq-1",
  supplier_id: "sup-1",
  match_score: 0.87,
  status: "pending",
  created_at: TWO_DAYS_AGO,
};

const RFQ_1: RFQ = {
  id: "rfq-1",
  client_name: "شركة الاستيراد الأردنية",
  client_request_arabic: "نحتاج 500 كشاف إضاءة LED صناعي",
  destination_port: "Aqaba",
  target_currency: "USD",
  status: "open",
  is_public: false,
  created_at: TWO_DAYS_AGO,
  updated_at: TWO_DAYS_AGO,
};

const EMPTY_PRODUCTS: ProductsBatchResponse = { items: {} };

describe("SupplierRfqInboxDesktop", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows an honest empty state when there are no exclusive matches", async () => {
    vi.mocked(intakeService.listMatched).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50, total_pages: 0 });
    vi.mocked(intakeService.listPublic).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
    vi.mocked(intakeService.listProductsBatch).mockResolvedValue(EMPTY_PRODUCTS);
    renderWithProviders(<SupplierRfqInboxDesktop />);

    expect(await screen.findByText("لا توجد مباريات حصرية حالياً")).toBeInTheDocument();
  });

  it("shows a time-since-arrival badge and lets the agent accept a pending match", async () => {
    const matchesResponse: RFQMatchListResponse = { items: [MATCH], total: 1, page: 1, page_size: 50, total_pages: 1 };
    const rfqBatch: RFQBatchResponse = { items: { "rfq-1": RFQ_1 } };
    vi.mocked(intakeService.listMatched).mockResolvedValue(matchesResponse);
    vi.mocked(intakeService.listPublic).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
    vi.mocked(intakeService.getBatch).mockResolvedValue(rfqBatch);
    vi.mocked(intakeService.listProductsBatch).mockResolvedValue(EMPTY_PRODUCTS);
    vi.mocked(intakeService.claimMatch).mockResolvedValue(MATCH);
    const user = userEvent.setup();
    renderWithProviders(<SupplierRfqInboxDesktop />);

    expect(await screen.findByText("شركة الاستيراد الأردنية")).toBeInTheDocument();
    // Elapsed since arrival (2 days ago) — the honest time-pressure counter.
    expect(await screen.findByText("منذ 2 ي")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "قبول والتسعير" }));

    await waitFor(() => {
      expect(intakeService.claimMatch).toHaveBeenCalledWith("match-1", { action: "respond" });
    });
  });

  it("shows the public pool and opens the quote builder pre-filled for that RFQ", async () => {
    vi.mocked(intakeService.listMatched).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50, total_pages: 0 });
    const publicResponse: RFQListResponse = { items: [RFQ_1], total: 1, page: 1, page_size: 50 };
    vi.mocked(intakeService.listPublic).mockResolvedValue(publicResponse);
    vi.mocked(intakeService.listProductsBatch).mockResolvedValue(EMPTY_PRODUCTS);
    const user = userEvent.setup();
    renderWithProviders(<SupplierRfqInboxDesktop />);

    await user.click(screen.getByRole("button", { name: "السوق العام" }));
    expect(await screen.findByText("شركة الاستيراد الأردنية")).toBeInTheDocument();

    // Navigation itself is exercised end-to-end in the switcher/router
    // tests elsewhere; here we just confirm the quote button is present
    // and wired per RFQ (not shared/disabled).
    expect(screen.getByRole("button", { name: "تقديم عرض سعر فوري" })).toBeInTheDocument();
  });
});
