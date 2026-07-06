import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AdminCatalogPageDesktop } from "../AdminCatalogPageDesktop";
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
      weight_kg: 1.2,
      dimensions: null,
      material: "ألومنيوم",
      category: "electronics",
      hs_code: null,
      supplier_id: "s1",
      supplier_name: "مصنع الأمل",
      factory_name: "مصنع الأمل",
      location_in_china: "قوانغتشو",
      document_id: "doc1",
      document_file_name: "catalog.pdf",
      extracted_at: "2026-01-01T00:00:00Z",
      review_status: "pending" as const,
    },
    {
      id: "p2",
      product_name: "كرسي مكتبي",
      model_number: null,
      unit_price_rmb: 40,
      moq: 100,
      weight_kg: null,
      dimensions: null,
      material: null,
      category: "furniture",
      hs_code: null,
      supplier_id: "s2",
      supplier_name: "مصنع النور",
      factory_name: "مصنع النور",
      location_in_china: null,
      document_id: null,
      document_file_name: null,
      extracted_at: "2026-01-01T00:00:00Z",
      review_status: "approved" as const,
    },
  ],
  total: 2,
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

describe("AdminCatalogPageDesktop", () => {
  it("renders products with real supplier names, statuses and a source link", () => {
    vi.mocked(useAdminCatalogData).mockReturnValue(baseData as any);
    renderWithProviders(<AdminCatalogPageDesktop />);

    expect(screen.getByText("إضاءة LED صناعية")).toBeInTheDocument();
    expect(screen.getByText("مصنع الأمل")).toBeInTheDocument();
    // Both status labels also label the filter tabs, so at least the row badge must be present.
    expect(screen.getAllByText("قيد المراجعة").length).toBeGreaterThan(0);
    expect(screen.getAllByText("معتمد").length).toBeGreaterThan(0);
    expect(screen.getByText(/المصدر: catalog\.pdf/)).toBeInTheDocument();
  });

  it("shows approve/reject actions for a pending product and a deactivate action for an approved one", () => {
    vi.mocked(useAdminCatalogData).mockReturnValue(baseData as any);
    renderWithProviders(<AdminCatalogPageDesktop />);

    expect(screen.getByText("اعتماد")).toBeInTheDocument();
    expect(screen.getByText("رفض")).toBeInTheDocument();
    expect(screen.getByText("تعطيل")).toBeInTheDocument();
  });

  it("shows the edit fields when a product is in edit mode", () => {
    vi.mocked(useAdminCatalogData).mockReturnValue({ ...baseData, editingId: "p1" } as any);
    renderWithProviders(<AdminCatalogPageDesktop />);
    expect(screen.getByText("حفظ")).toBeInTheDocument();
    expect(screen.getByText("رقم الموديل")).toBeInTheDocument();
  });

  it("shows the honest empty state instead of a list when nothing matches the filters", () => {
    vi.mocked(useAdminCatalogData).mockReturnValue({ ...baseData, products: [] } as any);
    renderWithProviders(<AdminCatalogPageDesktop />);
    expect(screen.getByText("لا توجد منتجات مطابقة للفلاتر الحالية")).toBeInTheDocument();
  });

  it("does not offer a manual create-product action", () => {
    vi.mocked(useAdminCatalogData).mockReturnValue(baseData as any);
    renderWithProviders(<AdminCatalogPageDesktop />);
    expect(screen.queryByText(/إضافة منتج/)).not.toBeInTheDocument();
  });
});
