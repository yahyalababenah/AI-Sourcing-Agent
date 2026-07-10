import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SupplierProfileMobile } from "../SupplierProfileMobile";
import { intakeService } from "@/services/intakeService";
import { quotationService } from "@/services/quotationService";
import { catalogService } from "@/services/catalogService";
import { useAuthStore } from "@/stores/authStore";
import type { CatalogProduct } from "@/types/catalog";

vi.mock("@/services/intakeService");
vi.mock("@/services/quotationService");
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
    location_in_china: "Shenzhen",
    document_id: null,
    document_file_name: null,
    extracted_at: null,
  },
];

describe("SupplierProfileMobile", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: "agent-1",
        email: "agent@example.com",
        full_name: "أحمد",
        role: "agent",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        profile: { factory_name: "Future Factory Ltd", location_in_china: "Shenzhen", verification_status: "pending" },
      } as any,
      role: "agent",
    });
    vi.mocked(intakeService.list).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });
    vi.mocked(quotationService.list).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(catalogService.search).mockResolvedValue({ items: PRODUCTS, total: 1, page: 1, page_size: 24, total_pages: 1 });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null, role: null });
    vi.restoreAllMocks();
  });

  it("headlines the rep's name, hides the verified badge for a non-verified rep, and shows honest dash stats", async () => {
    renderWithProviders(<SupplierProfileMobile />);

    expect(await screen.findByText("أحمد")).toBeInTheDocument(); // the sales rep, not the factory
    expect(screen.queryByText("مندوب موثّق")).not.toBeInTheDocument();
    expect(await screen.findByText("—")).toBeInTheDocument(); // no quotes yet => honest dash response time
  });

  it("opens the edit form when 'تعديل الملف' is clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderWithProviders(<SupplierProfileMobile />);

    await screen.findByText("أحمد");
    await user.click(screen.getByText("تعديل الملف"));

    expect(await screen.findByText("تعديل الملف الشخصي")).toBeInTheDocument();
  });
});
