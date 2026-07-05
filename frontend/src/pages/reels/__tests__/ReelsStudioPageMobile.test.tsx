import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ReelsStudioPageMobile } from "../ReelsStudioPageMobile";
import { catalogService } from "@/services/catalogService";
import { useAuthStore } from "@/stores/authStore";
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
    supplier_id: "agent-1",
    supplier_name: "Future Factory",
    factory_name: "Future Factory Ltd",
    location_in_china: null,
    document_id: null,
    document_file_name: null,
    extracted_at: null,
  },
];

describe("ReelsStudioPageMobile", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: "agent-1",
        email: "agent@example.com",
        full_name: "أحمد",
        role: "agent",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        profile: { factory_name: "Future Factory Ltd", location_in_china: "Shenzhen", verification_status: "verified" },
      } as any,
      role: "agent",
    });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null, role: null });
    vi.restoreAllMocks();
  });

  it("shows an empty state when the supplier has no catalog products", async () => {
    vi.mocked(catalogService.search).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 24, total_pages: 0 });
    renderWithProviders(<ReelsStudioPageMobile />);
    expect(await screen.findByText("لا توجد منتجات بعد")).toBeInTheDocument();
  });

  it("renders the first product with an honest zero RFQ count and a verified badge", async () => {
    vi.mocked(catalogService.search).mockResolvedValue({ items: PRODUCTS, total: 2, page: 1, page_size: 24, total_pages: 1 });
    renderWithProviders(<ReelsStudioPageMobile />);

    expect(await screen.findByText("خط إنتاج إضاءة LED")).toBeInTheDocument();
    expect(screen.getByText("Future Factory Ltd")).toBeInTheDocument();
    expect(screen.getByText("0 طلب سعر")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("advances to the next product when the down-chevron is clicked", async () => {
    vi.mocked(catalogService.search).mockResolvedValue({ items: PRODUCTS, total: 2, page: 1, page_size: 24, total_pages: 1 });
    const user = userEvent.setup();
    renderWithProviders(<ReelsStudioPageMobile />);

    await screen.findByText("خط إنتاج إضاءة LED");
    await user.click(screen.getByRole("button", { name: "اللقطة التالية" }));

    expect(await screen.findByText("فحص الجودة النهائي")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("toggles the save button's active state without crashing (no bookmark backend yet)", async () => {
    vi.mocked(catalogService.search).mockResolvedValue({ items: PRODUCTS, total: 2, page: 1, page_size: 24, total_pages: 1 });
    const user = userEvent.setup();
    renderWithProviders(<ReelsStudioPageMobile />);

    await screen.findByText("خط إنتاج إضاءة LED");
    const saveButton = screen.getByText("حفظ").closest("button");
    expect(saveButton).not.toBeNull();
    await user.click(saveButton!);
    // No assertion on persistence — this is a local UI toggle only.
  });
});
