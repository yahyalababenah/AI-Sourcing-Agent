import { describe, expect, it, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ClientReelsPageDesktop } from "../ClientReelsPageDesktop";
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
    category: "إضاءة",
    hs_code: null,
    supplier_id: "agent-1",
    supplier_name: "Future Factory",
    factory_name: "Future Factory Ltd",
    location_in_china: null,
    document_id: null,
    document_file_name: null,
    extracted_at: null,
  },
  {
    id: "p2",
    product_name: "فحص الجودة النهائي",
    model_number: null,
    unit_price_rmb: 2850,
    moq: 50,
    weight_kg: 2,
    dimensions: null,
    material: null,
    category: null,
    hs_code: null,
    supplier_id: "agent-2",
    supplier_name: "Golden Gear",
    factory_name: "Golden Gear Ltd",
    location_in_china: null,
    document_id: null,
    document_file_name: null,
    extracted_at: null,
  },
];

describe("ClientReelsPageDesktop", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows an empty state when the marketplace has no products", async () => {
    vi.mocked(catalogService.search).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 24, total_pages: 0 });
    renderWithProviders(<ClientReelsPageDesktop />);
    expect(await screen.findByText("لا توجد لقطات بعد")).toBeInTheDocument();
  });

  it("renders no performance panel and no upload button (consumer-only view)", async () => {
    vi.mocked(catalogService.search).mockResolvedValue({ items: PRODUCTS, total: 2, page: 1, page_size: 24, total_pages: 1 });
    renderWithProviders(<ClientReelsPageDesktop />);

    await screen.findByText("لقطات أخرى");
    expect(screen.getAllByText("خط إنتاج إضاءة LED").length).toBeGreaterThan(0);
    expect(screen.queryByText("طلبات سعر")).not.toBeInTheDocument();
    expect(screen.queryByText(/ارفع لقطة جديدة/)).not.toBeInTheDocument();
  });

  it("switches the player when a different row in 'لقطات أخرى' is selected", async () => {
    vi.mocked(catalogService.search).mockResolvedValue({ items: PRODUCTS, total: 2, page: 1, page_size: 24, total_pages: 1 });
    const user = userEvent.setup();
    renderWithProviders(<ClientReelsPageDesktop />);

    await screen.findByText("لقطات أخرى");
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    await user.click(screen.getByText("فحص الجودة النهائي"));
    expect(await screen.findByText("2 / 2")).toBeInTheDocument();
  });
});
