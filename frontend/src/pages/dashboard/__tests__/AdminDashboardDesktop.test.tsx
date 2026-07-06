import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AdminDashboardDesktop } from "../AdminDashboardDesktop";
import { useAdminDashboardData } from "../useAdminDashboardData";
import { useAuthStore } from "@/stores/authStore";

vi.mock("../useAdminDashboardData");

const rule = (overrides: Partial<any> = {}): any => ({
  id: "rule-1",
  name: "رسوم تخليص",
  category: "customs",
  rule_type: "fixed",
  value: 150,
  currency: "USD",
  priority: 1,
  ...overrides,
});

const baseData = {
  stats: { total_rfqs: 12, total_quotations: 8, total_users: 40, total_catalog_products: 300 },
  statsLoading: false,
  aiCosts: null,
  aiCostsLoading: false,
  refreshAiCosts: vi.fn(),
  activeRules: [] as any[],
  rulesLoading: false,
};

describe("AdminDashboardDesktop", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: "admin-1", email: "admin@example.com", full_name: "سارة", role: "admin" } as any,
      role: "admin",
    });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null, role: null });
  });

  it("renders the 4 KPI stat cards with real system-wide counts", () => {
    vi.mocked(useAdminDashboardData).mockReturnValue(baseData as any);
    renderWithProviders(<AdminDashboardDesktop />);

    expect(screen.getByText("إجمالي طلبات العروض")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("عروض الأسعار")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("المستخدمين")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText("منتجات الكتالوج")).toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument();
  });

  it("shows a real AI cost breakdown when available", () => {
    vi.mocked(useAdminDashboardData).mockReturnValue({
      ...baseData,
      aiCosts: { total_cost: "12.3400", total_calls: 55, cost_last_24h: "0.5000", calls_last_24h: 3, by_model: [], by_provider: [], period_days: 30 },
    } as any);
    renderWithProviders(<AdminDashboardDesktop />);

    expect(screen.getByText("$12.3400")).toBeInTheDocument();
    expect(screen.getByText("55")).toBeInTheDocument();
  });

  it("shows an honest unavailable message instead of fabricating AI cost numbers", () => {
    vi.mocked(useAdminDashboardData).mockReturnValue(baseData as any);
    renderWithProviders(<AdminDashboardDesktop />);
    expect(screen.getByText("بيانات التكاليف غير متوفرة")).toBeInTheDocument();
  });

  it("renders the active pricing rules table when rules exist", () => {
    vi.mocked(useAdminDashboardData).mockReturnValue({
      ...baseData,
      activeRules: [rule()],
    } as any);
    renderWithProviders(<AdminDashboardDesktop />);
    expect(screen.getByText("رسوم تخليص")).toBeInTheDocument();
    expect(screen.getByText("150 USD")).toBeInTheDocument();
  });

  it("shows an empty state when there are no active pricing rules", () => {
    vi.mocked(useAdminDashboardData).mockReturnValue(baseData as any);
    renderWithProviders(<AdminDashboardDesktop />);
    expect(screen.getByText("لا توجد قواعد تسعير نشطة")).toBeInTheDocument();
  });

  it("does not offer a fake 'user management' quick link pointing at the unrelated settings stub", () => {
    vi.mocked(useAdminDashboardData).mockReturnValue(baseData as any);
    renderWithProviders(<AdminDashboardDesktop />);
    expect(screen.queryByText("إدارة المستخدمين")).not.toBeInTheDocument();
    expect(screen.getByText("مراقبة النظام")).toBeInTheDocument();
  });
});
