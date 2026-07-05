import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ClientReelsPage } from "../ClientReelsPage";
import { catalogService } from "@/services/catalogService";
import type { CatalogProduct } from "@/types/catalog";

vi.mock("@/services/catalogService");

const PRODUCTS: CatalogProduct[] = [
  {
    id: "p1",
    product_name: "خط إنتاج إضاءة LED",
    model_number: null,
    unit_price_rmb: 4200,
    moq: 100,
    weight_kg: 5,
    dimensions: null,
    material: null,
    category: null,
    hs_code: null,
    supplier_id: "agent-1",
    supplier_name: "Future Factory",
    factory_name: "Future Factory Ltd",
    location_in_china: null,
    document_id: null,
    document_file_name: null,
    extracted_at: null,
  },
];

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

describe("ClientReelsPage switcher", () => {
  beforeEach(() => {
    vi.mocked(catalogService.search).mockResolvedValue({ items: PRODUCTS, total: 1, page: 1, page_size: 24, total_pages: 1 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the desktop 300px-player + browse-list layout at >=1024px", async () => {
    mockMatchMedia(true);
    renderWithProviders(<ClientReelsPage />);
    expect(await screen.findByText("لقطات أخرى")).toBeInTheDocument();
  });

  it("renders the mobile full-screen player layout below 1024px", async () => {
    mockMatchMedia(false);
    renderWithProviders(<ClientReelsPage />);
    expect(await screen.findByText("خط إنتاج إضاءة LED")).toBeInTheDocument();
    expect(screen.queryByText("لقطات أخرى")).not.toBeInTheDocument();
  });
});
