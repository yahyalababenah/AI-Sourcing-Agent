import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ReelsStudioPageDesktop } from "../ReelsStudioPageDesktop";
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

describe("ReelsStudioPageDesktop", () => {
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
    renderWithProviders(<ReelsStudioPageDesktop />);
    expect(await screen.findByText("لا توجد منتجات بعد")).toBeInTheDocument();
  });

  it("shows an honest zero/dash performance panel — no fabricated analytics", async () => {
    vi.mocked(catalogService.search).mockResolvedValue({ items: PRODUCTS, total: 2, page: 1, page_size: 24, total_pages: 1 });
    renderWithProviders(<ReelsStudioPageDesktop />);

    await screen.findByText("أستوديو لقطات المصنع");
    expect(screen.getByText("طلبات سعر")).toBeInTheDocument();
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("lists all clips and switches the player when a different row is selected", async () => {
    vi.mocked(catalogService.search).mockResolvedValue({ items: PRODUCTS, total: 2, page: 1, page_size: 24, total_pages: 1 });
    const user = userEvent.setup();
    renderWithProviders(<ReelsStudioPageDesktop />);

    await screen.findByText("كل اللقطات");
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    await user.click(screen.getByText("فحص الجودة النهائي"));
    expect(await screen.findByText("2 / 2")).toBeInTheDocument();
  });
});
