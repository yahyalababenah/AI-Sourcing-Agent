import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AdminDashboard } from "../AdminDashboard";
import { useAdminDashboardData } from "../useAdminDashboardData";

vi.mock("../useAdminDashboardData");

// CLAUDE.md forbids one responsive file for a screen — AdminDashboard must
// pick between two genuinely separate desktop/mobile files.
describe("AdminDashboard — desktop/mobile file switcher", () => {
  const emptyData = {
    stats: { total_rfqs: 0, total_quotations: 0, total_users: 0, total_catalog_products: 0 },
    statsLoading: false,
    aiCosts: null,
    aiCostsLoading: false,
    refreshAiCosts: vi.fn(),
    activeRules: [],
    rulesLoading: false,
  };

  beforeEach(() => {
    vi.mocked(useAdminDashboardData).mockReturnValue(emptyData as any);
  });

  it("renders the desktop layout (full-width KPI grid table header) when the viewport matches desktop", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true, media: "", onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    } as any);

    renderWithProviders(<AdminDashboard />);
    expect(screen.getByText("صلاحية كاملة")).toBeInTheDocument();
  });

  it("renders the mobile layout (compact 'مشرف' badge, not the desktop-only label) when the viewport doesn't match desktop", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false, media: "", onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    } as any);

    renderWithProviders(<AdminDashboard />);
    expect(screen.getByText("مشرف")).toBeInTheDocument();
    expect(screen.queryByText("صلاحية كاملة")).not.toBeInTheDocument();
  });
});
