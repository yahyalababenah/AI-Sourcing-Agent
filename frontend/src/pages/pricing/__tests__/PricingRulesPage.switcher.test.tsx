import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { PricingRulesPage } from "../PricingRulesPage";
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

// CLAUDE.md forbids one responsive file for a screen — PricingRulesPage
// must pick between two genuinely separate desktop/mobile files.
describe("PricingRulesPage — desktop/mobile file switcher", () => {
  it("renders the desktop table headers when the viewport matches desktop", () => {
    vi.mocked(usePricingRulesData).mockReturnValue(baseData as any);
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true, media: "", onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    } as any);

    renderWithProviders(<PricingRulesPage />);
    expect(screen.getByText("الإجراءات")).toBeInTheDocument();
  });

  it("renders the mobile stacked cards (no table headers) when the viewport doesn't match desktop", () => {
    vi.mocked(usePricingRulesData).mockReturnValue(baseData as any);
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false, media: "", onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    } as any);

    renderWithProviders(<PricingRulesPage />);
    expect(screen.queryByText("الإجراءات")).not.toBeInTheDocument();
    expect(screen.getByText("عمولة المندوب")).toBeInTheDocument();
  });
});
