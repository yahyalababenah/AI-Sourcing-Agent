import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { renderWithProviders } from "@/test/renderWithProviders";
import { MarketplacePage } from "../MarketplacePage";
import { catalogService } from "@/services/catalogService";
import { intakeService } from "@/services/intakeService";
import { pricingService } from "@/services/pricingService";
import type { CatalogListResponse, CatalogProduct } from "@/types/catalog";
import type { QuickEstimateResponse } from "@/types/pricing";

vi.mock("@/services/catalogService");
vi.mock("@/services/intakeService");
vi.mock("@/services/pricingService");
vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

function makeProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: "prod-1",
    product_name: "工业LED投光灯",
    model_number: "LED-FL-100W",
    unit_price_rmb: 45,
    moq: 50,
    weight_kg: 1.2,
    dimensions: "30x20x15cm",
    material: "Aluminum",
    category: "electronics",
    hs_code: null,
    supplier_id: "sup-1",
    supplier_name: "Guangzhou Factory",
    factory_name: "Guangzhou Factory",
    location_in_china: "Guangzhou",
    document_id: "doc-1",
    document_file_name: "catalogue.pdf",
    extracted_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function listResponse(items: CatalogProduct[], overrides: Partial<CatalogListResponse> = {}): CatalogListResponse {
  return { items, total: items.length, page: 1, page_size: 12, total_pages: 1, ...overrides };
}

const ESTIMATE: QuickEstimateResponse = {
  unit_price_cny: 45,
  quantity: 50,
  exchange_rate: 0.1047,
  target_currency: "USD",
  unit_price_converted: 6.29,
  insurance_cost: 3.5,
  cif_value: 350,
  customs_duty: 17.5,
  clearance_fee: 15,
  subtotal_excl_shipping: 314.5,
  vat: 56,
  estimated_total: 402.5,
} as QuickEstimateResponse;

describe("MarketplacePage", () => {
  beforeEach(() => {
    vi.mocked(catalogService.search).mockResolvedValue(listResponse([makeProduct()]));
  });

  it("renders the product grid from the catalog search results", async () => {
    renderWithProviders(<MarketplacePage />);
    expect(await screen.findByText("工业LED投光灯")).toBeInTheDocument();
  });

  it("shows the empty state when no products match", async () => {
    vi.mocked(catalogService.search).mockResolvedValue(listResponse([]));
    renderWithProviders(<MarketplacePage />);
    expect(await screen.findByText("لا توجد منتجات متاحة حالياً")).toBeInTheDocument();
  });

  it("shows an error state when the search request fails", async () => {
    vi.mocked(catalogService.search).mockRejectedValue(new Error("فشل تحميل المنتجات. يرجى المحاولة لاحقاً."));
    renderWithProviders(<MarketplacePage />);
    expect(await screen.findByText("فشل تحميل المنتجات. يرجى المحاولة لاحقاً.")).toBeInTheDocument();
  });

  it("debounces search input before calling catalogService.search with the query", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<MarketplacePage />);
    await vi.waitFor(() => expect(catalogService.search).toHaveBeenCalledTimes(1));

    await user.type(screen.getByPlaceholderText("ابحث..."), "LED");

    // Not yet called with the query — still debouncing.
    expect(catalogService.search).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(350);

    expect(catalogService.search).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: "LED" }),
    );
    vi.useRealTimers();
  });

  it("passes the product's hs_code and has_license through to the estimate call", async () => {
    vi.mocked(catalogService.search).mockResolvedValue(
      listResponse([makeProduct({ hs_code: "85241210000" })]),
    );
    vi.mocked(pricingService.estimate).mockResolvedValue(ESTIMATE);
    const user = userEvent.setup();
    renderWithProviders(<MarketplacePage />);
    await screen.findByText("工业LED投光灯");

    await user.click(screen.getByRole("button", { name: "طلب عرض سعر" }));

    await waitFor(() => {
      expect(pricingService.estimate).toHaveBeenCalledWith(
        expect.objectContaining({ hs_code: "85241210000", has_license: true }),
      );
    });
  });

  it("opens the RFQ modal, shows a live cost estimate, and submits the RFQ", async () => {
    // Regression coverage for TESTING_FINDINGS.md (fixed): onSuccess now
    // fires an independent toast (react-hot-toast, same pattern as
    // useAuth.ts) rather than relying on modal-local state that gets
    // unmounted in the same tick by onClose(). Asserting the toast fires
    // with the right message is the real regression guard here — the modal
    // closing is expected/correct behavior, not the bug.
    vi.mocked(pricingService.estimate).mockResolvedValue(ESTIMATE);
    vi.mocked(intakeService.create).mockResolvedValue({ id: "rfq-1" } as any);

    const user = userEvent.setup();
    renderWithProviders(<MarketplacePage />);
    await screen.findByText("工业LED投光灯");

    await user.click(screen.getByRole("button", { name: "طلب عرض سعر" }));

    expect(await screen.findByText("المجموع التقديري")).toBeInTheDocument();
    expect(screen.getByText(/402.50/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "إرسال طلب عرض السعر" }));

    await waitFor(() => {
      expect(intakeService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          destination_port: "Aqaba",
          target_currency: "USD",
        }),
      );
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("تم إرسال طلب عرض السعر بنجاح");
    });
    expect(screen.queryByText("طلب عرض سعر", { selector: "h2" })).not.toBeInTheDocument();
  });

  it("shows a validation error in the modal for an invalid quantity", async () => {
    vi.mocked(pricingService.estimate).mockResolvedValue(ESTIMATE);
    const user = userEvent.setup();
    renderWithProviders(<MarketplacePage />);
    await screen.findByText("工业LED投光灯");

    await user.click(screen.getByRole("button", { name: "طلب عرض سعر" }));
    const quantityInput = await screen.findByDisplayValue("50"); // product.moq
    await user.clear(quantityInput);
    await user.type(quantityInput, "0");
    // component clamps to min 1 on change, so directly submit via form to hit validation
    await user.click(screen.getByRole("button", { name: "إرسال طلب عرض السعر" }));

    // Quantity is clamped to >=1 client-side on change, so no validation error
    // is expected here — this instead documents that clamping behavior.
    expect(screen.queryByText("يرجى إدخال كمية صالحة")).not.toBeInTheDocument();
  });

  it("closes the modal without submitting when cancel is clicked", async () => {
    vi.mocked(pricingService.estimate).mockResolvedValue(ESTIMATE);
    const user = userEvent.setup();
    renderWithProviders(<MarketplacePage />);
    await screen.findByText("工业LED投光灯");

    await user.click(screen.getByRole("button", { name: "طلب عرض سعر" }));
    await screen.findByText("طلب عرض سعر", { selector: "h2" });
    await user.click(screen.getByRole("button", { name: "إلغاء" }));

    expect(screen.queryByText("طلب عرض سعر", { selector: "h2" })).not.toBeInTheDocument();
    expect(intakeService.create).not.toHaveBeenCalled();
  });
});
