import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AdminCatalogPageMobile } from "../AdminCatalogPageMobile";
import { useAdminCatalogData } from "../useAdminCatalogData";

vi.mock("../useAdminCatalogData", async () => {
  const actual = await vi.importActual<typeof import("../useAdminCatalogData")>("../useAdminCatalogData");
  return { ...actual, useAdminCatalogData: vi.fn() };
});

const baseData = {
  products: [
    {
      id: "p1",
      product_name: "إضاءة LED صناعية",
      model_number: "X100",
      unit_price_rmb: 12.5,
      moq: 500,
      weight_kg: null,
      dimensions: null,
      material: null,
      category: "electronics",
      hs_code: null,
      supplier_id: "s1",
      supplier_name: "مصنع الأمل",
      factory_name: "مصنع الأمل",
      location_in_china: null,
      document_id: "doc1",
      document_file_name: "catalog.pdf",
      extracted_at: "2026-01-01T00:00:00Z",
      review_status: "pending" as const,
    },
  ],
  total: 1,
  isLoading: false,
  error: null,
  statusFilter: "pending" as const,
  setStatusFilter: vi.fn(),
  categoryFilter: undefined,
  setCategoryFilter: vi.fn(),
  editingId: null,
  editForm: {},
  setEditForm: vi.fn(),
  startEdit: vi.fn(),
  cancelEdit: vi.fn(),
  setStatus: vi.fn(),
  saveEdits: vi.fn(),
  reviewMutation: { isPending: false, variables: undefined } as any,
};

describe("AdminCatalogPageMobile", () => {
  it("renders stacked product cards with the same data/actions as desktop", () => {
    vi.mocked(useAdminCatalogData).mockReturnValue(baseData as any);
    renderWithProviders(<AdminCatalogPageMobile />);

    expect(screen.getByText("إضاءة LED صناعية")).toBeInTheDocument();
    expect(screen.getByText("مصنع الأمل")).toBeInTheDocument();
    expect(screen.getByText("اعتماد")).toBeInTheDocument();
    expect(screen.getByText(/المصدر: catalog\.pdf/)).toBeInTheDocument();
  });

  it("shows a loading skeleton while fetching", () => {
    vi.mocked(useAdminCatalogData).mockReturnValue({ ...baseData, isLoading: true, products: [] } as any);
    const { container } = renderWithProviders(<AdminCatalogPageMobile />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
