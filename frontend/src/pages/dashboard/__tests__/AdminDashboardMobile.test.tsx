import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AdminDashboardMobile } from "../AdminDashboardMobile";
import { useAdminDashboardData } from "../useAdminDashboardData";
import { useAuthStore } from "@/stores/authStore";

vi.mock("../useAdminDashboardData");

const baseData = {
  stats: { total_rfqs: 3, total_quotations: 1, total_users: 9, total_catalog_products: 20 },
  statsLoading: false,
  aiCosts: null,
  aiCostsLoading: false,
  refreshAiCosts: vi.fn(),
  activeRules: [] as any[],
  rulesLoading: false,
};

describe("AdminDashboardMobile", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: "admin-1", email: "admin@example.com", full_name: "سارة", role: "admin" } as any,
      role: "admin",
    });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null, role: null });
  });

  it("stacks all 4 KPI cards in a single-column mobile layout with real counts", () => {
    vi.mocked(useAdminDashboardData).mockReturnValue(baseData as any);
    renderWithProviders(<AdminDashboardMobile />);

    expect(screen.getByText("طلبات العروض")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("المستخدمين")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
  });

  it("renders active pricing rules as stacked rows instead of a wide table", () => {
    vi.mocked(useAdminDashboardData).mockReturnValue({
      ...baseData,
      activeRules: [
        { id: "r1", name: "ضريبة القيمة المضافة", category: "vat", rule_type: "percentage", value: 16, currency: null, priority: 2 },
      ],
    } as any);
    renderWithProviders(<AdminDashboardMobile />);

    expect(screen.getByText("ضريبة القيمة المضافة")).toBeInTheDocument();
    expect(screen.getByText("16%")).toBeInTheDocument();
  });

  it("shows an honest empty state instead of fabricating pricing rules", () => {
    vi.mocked(useAdminDashboardData).mockReturnValue(baseData as any);
    renderWithProviders(<AdminDashboardMobile />);
    expect(screen.getByText("لا توجد قواعد تسعير نشطة")).toBeInTheDocument();
  });
});
