import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { PricingRulesPageMobile } from "../PricingRulesPageMobile";
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
  ],
  total: 1,
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

describe("PricingRulesPageMobile", () => {
  it("renders stacked rule cards (no table headers) with the same data as desktop", () => {
    vi.mocked(usePricingRulesData).mockReturnValue(baseData as any);
    renderWithProviders(<PricingRulesPageMobile />);

    expect(screen.getByText("عمولة المندوب")).toBeInTheDocument();
    expect(screen.getByText("نشط")).toBeInTheDocument();
    expect(screen.getByText("تعديل")).toBeInTheDocument();
    expect(screen.queryByText("الإجراءات")).not.toBeInTheDocument();
  });

  it("shows a loading skeleton while fetching", () => {
    vi.mocked(usePricingRulesData).mockReturnValue({ ...baseData, isLoading: true, rules: [] } as any);
    const { container } = renderWithProviders(<PricingRulesPageMobile />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
