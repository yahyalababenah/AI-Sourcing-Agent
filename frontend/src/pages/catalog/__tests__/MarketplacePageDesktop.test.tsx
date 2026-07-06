import { describe, expect, it, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { MarketplacePageDesktop } from "../MarketplacePageDesktop";
import { catalogService } from "@/services/catalogService";
import type { CatalogListResponse, CatalogProduct } from "@/types/catalog";

vi.mock("@/services/catalogService");

function makeProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: "prod-1",
    product_name: "كشاف LED صناعي",
    model_number: "LED-100",
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

describe("MarketplacePageDesktop", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not fabricate a verification badge, rating, or certifications on the card", async () => {
    vi.mocked(catalogService.search).mockResolvedValue(listResponse([makeProduct()]));
    renderWithProviders(<MarketplacePageDesktop />);

    expect(await screen.findByText("كشاف LED صناعي")).toBeInTheDocument();
    expect(screen.queryByText("مُعتمَد")).not.toBeInTheDocument();
    expect(screen.queryByText("CE")).not.toBeInTheDocument();
    expect(screen.queryByText("ISO")).not.toBeInTheDocument();
  });

  it("filters by category and shows a real, clearable active-filter chip", async () => {
    vi.mocked(catalogService.search).mockResolvedValue(listResponse([makeProduct()]));
    const user = userEvent.setup();
    renderWithProviders(<MarketplacePageDesktop />);

    await screen.findByText("كشاف LED صناعي");
    await user.selectOptions(screen.getByDisplayValue("جميع الفئات"), "electronics");

    await waitFor(() => {
      expect(catalogService.search).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: "electronics" }),
      );
    });

    expect(screen.getByRole("button", { name: /إلكترونيات/ })).toBeInTheDocument();

    await user.click(screen.getByText("مسح الكل"));
    await waitFor(() => {
      expect(catalogService.search).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: undefined }),
      );
    });
  });
});
