import { describe, expect, it, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ClientReelsPageMobile } from "../ClientReelsPageMobile";
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

describe("ClientReelsPageMobile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows an empty state when the marketplace has no products", async () => {
    vi.mocked(catalogService.search).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 24, total_pages: 0 });
    renderWithProviders(<ClientReelsPageMobile />);
    expect(await screen.findByText("لا توجد لقطات بعد")).toBeInTheDocument();
  });

  it("renders the first product with its factory name and a follow-factory button, no RFQ/views counters", async () => {
    vi.mocked(catalogService.search).mockResolvedValue({ items: PRODUCTS, total: 2, page: 1, page_size: 24, total_pages: 1 });
    renderWithProviders(<ClientReelsPageMobile />);

    expect(await screen.findByText("خط إنتاج إضاءة LED")).toBeInTheDocument();
    expect(screen.getByText("Future Factory Ltd")).toBeInTheDocument();
    expect(screen.getByText("تابع المصنع")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.queryByText(/طلب سعر ناتج|مشاهدات/)).not.toBeInTheDocument();
  });

  it("advances to the next product when the down-chevron is clicked", async () => {
    vi.mocked(catalogService.search).mockResolvedValue({ items: PRODUCTS, total: 2, page: 1, page_size: 24, total_pages: 1 });
    const user = userEvent.setup();
    renderWithProviders(<ClientReelsPageMobile />);

    await screen.findByText("خط إنتاج إضاءة LED");
    await user.click(screen.getByRole("button", { name: "اللقطة التالية" }));

    expect(await screen.findByText("فحص الجودة النهائي")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("toggles follow-factory to an active 'متابَع' state", async () => {
    vi.mocked(catalogService.search).mockResolvedValue({ items: PRODUCTS, total: 2, page: 1, page_size: 24, total_pages: 1 });
    const user = userEvent.setup();
    renderWithProviders(<ClientReelsPageMobile />);

    await screen.findByText("خط إنتاج إضاءة LED");
    await user.click(screen.getByText("تابع المصنع"));

    expect(await screen.findByText("متابَع")).toBeInTheDocument();
  });
});
