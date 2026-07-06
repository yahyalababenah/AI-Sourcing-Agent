import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AdminCatalogPage } from "../AdminCatalogPage";
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
      model_number: null,
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
      document_id: null,
      document_file_name: null,
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

// CLAUDE.md forbids one responsive file for a screen — AdminCatalogPage
// must pick between two genuinely separate desktop/mobile files.
describe("AdminCatalogPage — desktop/mobile file switcher", () => {
  it("renders the desktop layout (header title in its own card, separate from filters) when the viewport matches desktop", () => {
    vi.mocked(useAdminCatalogData).mockReturnValue(baseData as any);
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true, media: "", onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    } as any);

    const { container } = renderWithProviders(<AdminCatalogPage />);
    expect(screen.getByText("إضاءة LED صناعية")).toBeInTheDocument();
    // Desktop splits header/filters into two top-level .card blocks; mobile combines them into one.
    expect(container.querySelector("h1.text-xl")).toBeInTheDocument();
  });

  it("renders the mobile layout (compact header) when the viewport doesn't match desktop", () => {
    vi.mocked(useAdminCatalogData).mockReturnValue(baseData as any);
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false, media: "", onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    } as any);

    const { container } = renderWithProviders(<AdminCatalogPage />);
    expect(screen.getByText("إضاءة LED صناعية")).toBeInTheDocument();
    expect(container.querySelector("h1.text-xl")).not.toBeInTheDocument();
    expect(container.querySelector("h1.text-base")).toBeInTheDocument();
  });
});
