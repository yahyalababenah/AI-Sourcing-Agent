import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AdminMonitorPageMobile } from "../AdminMonitorPageMobile";
import { useAdminMonitorData } from "../useAdminMonitorData";

vi.mock("../useAdminMonitorData");

const baseData = {
  health: {
    status: "degraded" as const,
    version: "1.4.0",
    environment: "production",
    services: { database: "connected", redis: "connected", minio: "connected", celery: "connected", llm: "circuit_open:openai" },
  },
  healthLoading: false,
  stats: { total_rfqs: 3, total_quotations: 1, total_users: 9, total_catalog_products: 20 },
  pings: [
    { label: "Health Check", endpoint: "http://api/health", method: "GET", latency: 620, status: 200, ok: true, history: [] },
  ],
  pinging: false,
  lastRefresh: new Date("2026-07-06T10:00:00Z"),
  handleRefresh: vi.fn(),
  services: { database: "connected", redis: "connected", minio: "connected", celery: "connected", llm: "circuit_open:openai" },
  isCircuitOpen: true,
  llmProviders: ["openai"],
  avgLatency: 100,
  failedPings: 0,
};

describe("AdminMonitorPageMobile", () => {
  it("stacks the 4 quick-stat cards and 5 service cards in a compact 2-column grid", () => {
    vi.mocked(useAdminMonitorData).mockReturnValue(baseData as any);
    renderWithProviders(<AdminMonitorPageMobile />);
    expect(screen.getByText("طلبات الشراء")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("قاعدة البيانات")).toBeInTheDocument();
  });

  it("shows the degraded system badge honestly instead of always claiming healthy", () => {
    vi.mocked(useAdminMonitorData).mockReturnValue(baseData as any);
    renderWithProviders(<AdminMonitorPageMobile />);
    expect(screen.getByText("أداء متدهور")).toBeInTheDocument();
  });

  it("shows the OPEN circuit breaker state on mobile too", () => {
    vi.mocked(useAdminMonitorData).mockReturnValue(baseData as any);
    renderWithProviders(<AdminMonitorPageMobile />);
    expect(screen.getByText("OPEN ⚠️")).toBeInTheDocument();
  });

  it("renders latency rows as compact stacked entries without the desktop endpoint-URL text", () => {
    vi.mocked(useAdminMonitorData).mockReturnValue(baseData as any);
    renderWithProviders(<AdminMonitorPageMobile />);
    expect(screen.getByText("Health Check")).toBeInTheDocument();
    expect(screen.getByText("620ms")).toBeInTheDocument();
    expect(screen.queryByText(/GET http/)).not.toBeInTheDocument();
  });
});
