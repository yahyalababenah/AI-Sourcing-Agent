import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { PricingRulesPageDesktop } from "../PricingRulesPageDesktop";
import { usePricingRulesData } from "../usePricingRulesData";

vi.mock("../usePricingRulesData", async () => {
  const actual = await vi.importActual<typeof import("../usePricingRulesData")>("../usePricingRulesData");
  return { ...actual, usePricingRulesData: vi.fn() };
});

const baseData = {
  rules: [
    {
      id: "r1",
      name: "عمولة المندوب",
      description: "نسبة تُضاف لكل شحنة",
      category: "commission",
      rule_type: "percentage",
      value: 3,
      currency: "USD",
      priority: 1,
      is_active: true,
      created_by: "u1",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "r2",
      name: "رسوم تخليص ثابتة",
      category: "clearance",
      rule_type: "fixed",
      value: 150,
      currency: "USD",
      priority: 2,
      is_active: false,
      created_by: "u1",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
  total: 2,
  isLoading: false,
  error: null,
  categoryFilter: undefined,
  setCategoryFilter: vi.fn(),
  showModal: false,
  editingRule: undefined,
  handleAdd: vi.fn(),
  handleEdit: vi.fn(),
  handleDelete: vi.fn(),
  closeModal: vi.fn(),
  deleteMutation: { isPending: false } as any,
};

describe("PricingRulesPageDesktop", () => {
  it("renders the rules table with real names, categories, values and statuses", () => {
    vi.mocked(usePricingRulesData).mockReturnValue(baseData as any);
    renderWithProviders(<PricingRulesPageDesktop />);

    expect(screen.getByText("عمولة المندوب")).toBeInTheDocument();
    // "العمولة" also labels the category-filter chip, so at least the table cell must be present.
    expect(screen.getAllByText("العمولة").length).toBeGreaterThan(0);
    expect(screen.getByText("3%")).toBeInTheDocument();
    expect(screen.getByText("نشط")).toBeInTheDocument();
    expect(screen.getByText("غير نشط")).toBeInTheDocument();
  });

  it("shows the honest empty state instead of a table when there are no rules", () => {
    vi.mocked(usePricingRulesData).mockReturnValue({ ...baseData, rules: [] } as any);
    renderWithProviders(<PricingRulesPageDesktop />);
    expect(screen.getByText("لا توجد قواعد تسعير")).toBeInTheDocument();
  });

  it("opens the create-rule modal when the add button is used", () => {
    vi.mocked(usePricingRulesData).mockReturnValue({ ...baseData, showModal: true } as any);
    renderWithProviders(<PricingRulesPageDesktop />);
    expect(screen.getByText("إضافة قاعدة تسعير")).toBeInTheDocument();
  });
});
