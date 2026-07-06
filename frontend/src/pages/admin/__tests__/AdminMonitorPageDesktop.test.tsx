import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AdminMonitorPageDesktop } from "../AdminMonitorPageDesktop";
import { useAdminMonitorData } from "../useAdminMonitorData";

vi.mock("../useAdminMonitorData");

const baseData = {
  health: {
    status: "ok" as const,
    version: "1.4.0",
    environment: "production",
    services: { database: "connected", redis: "connected", minio: "connected", celery: "connected", llm: "configured:openai" },
  },
  healthLoading: false,
  stats: { total_rfqs: 12, total_quotations: 8, total_users: 40, total_catalog_products: 300, users_by_role: { admin: 1, agent: 5, client: 34 } },
  pings: [
    { label: "Health Check", endpoint: "http://api/health", method: "GET", latency: 42, status: 200, ok: true, history: [40, 42] },
    { label: "Auth / Me", endpoint: "http://api/api/v1/auth/me", method: "GET", latency: null, status: null, ok: false, history: [] },
  ],
  pinging: false,
  lastRefresh: new Date("2026-07-06T10:00:00Z"),
  handleRefresh: vi.fn(),
  services: { database: "connected", redis: "connected", minio: "connected", celery: "connected", llm: "configured:openai" },
  isCircuitOpen: false,
  llmProviders: ["openai"],
  avgLatency: 55,
  failedPings: 0,
};

describe("AdminMonitorPageDesktop", () => {
  it("shows the 5 service health cards with their real connection status", () => {
    vi.mocked(useAdminMonitorData).mockReturnValue(baseData as any);
    renderWithProviders(<AdminMonitorPageDesktop />);

    expect(screen.getByText("قاعدة البيانات")).toBeInTheDocument();
    expect(screen.getByText("Redis")).toBeInTheDocument();
    expect(screen.getByText("MinIO")).toBeInTheDocument();
    expect(screen.getByText("Celery")).toBeInTheDocument();
    expect(screen.getByText("LLM")).toBeInTheDocument();
    expect(screen.getAllByText("connected").length).toBe(4);
  });

  it("shows the quick stats with real system-wide counts", () => {
    vi.mocked(useAdminMonitorData).mockReturnValue(baseData as any);
    renderWithProviders(<AdminMonitorPageDesktop />);
    expect(screen.getByText("طلبات الشراء")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument();
  });

  it("renders endpoint latency rows with real ms values and an honest dash for a failed/unreachable ping", () => {
    vi.mocked(useAdminMonitorData).mockReturnValue(baseData as any);
    renderWithProviders(<AdminMonitorPageDesktop />);
    expect(screen.getByText("42ms")).toBeInTheDocument();
    expect(screen.getByText("GET http://api/api/v1/auth/me")).toBeInTheDocument();
  });

  it("shows the LLM circuit breaker as CLOSED when healthy", () => {
    vi.mocked(useAdminMonitorData).mockReturnValue(baseData as any);
    renderWithProviders(<AdminMonitorPageDesktop />);
    expect(screen.getByText("CLOSED ✓")).toBeInTheDocument();
  });

  it("shows the OPEN circuit warning instead of hiding the failure", () => {
    vi.mocked(useAdminMonitorData).mockReturnValue({ ...baseData, isCircuitOpen: true } as any);
    renderWithProviders(<AdminMonitorPageDesktop />);
    expect(screen.getByText("OPEN ⚠️")).toBeInTheDocument();
    expect(screen.getByText(/الـ circuit مفتوح/)).toBeInTheDocument();
  });

  it("shows an honest 'no provider configured' message instead of fabricating one", () => {
    vi.mocked(useAdminMonitorData).mockReturnValue({ ...baseData, llmProviders: [] } as any);
    renderWithProviders(<AdminMonitorPageDesktop />);
    expect(screen.getByText("لا يوجد LLM provider مُهيأ")).toBeInTheDocument();
  });
});
