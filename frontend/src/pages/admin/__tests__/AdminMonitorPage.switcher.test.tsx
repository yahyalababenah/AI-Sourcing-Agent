import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AdminMonitorPage } from "../AdminMonitorPage";
import { useAdminMonitorData } from "../useAdminMonitorData";

vi.mock("../useAdminMonitorData");

const emptyData = {
  health: undefined,
  healthLoading: false,
  stats: undefined,
  pings: [
    { label: "Health Check", endpoint: "http://api/health", method: "GET", latency: 10, status: 200, ok: true, history: [] },
  ],
  pinging: false,
  lastRefresh: new Date("2026-07-06T10:00:00Z"),
  handleRefresh: vi.fn(),
  services: undefined,
  isCircuitOpen: false,
  llmProviders: [],
  avgLatency: 10,
  failedPings: 0,
};

// CLAUDE.md forbids one responsive file for a screen — AdminMonitorPage
// must pick between two genuinely separate desktop/mobile files.
describe("AdminMonitorPage — desktop/mobile file switcher", () => {
  it("renders the desktop layout's endpoint URL text when the viewport matches desktop", () => {
    vi.mocked(useAdminMonitorData).mockReturnValue(emptyData as any);
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true, media: "", onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    } as any);

    renderWithProviders(<AdminMonitorPage />);
    expect(screen.getByText("GET http://api/health")).toBeInTheDocument();
  });

  it("renders the mobile layout (no endpoint URL text) when the viewport doesn't match desktop", () => {
    vi.mocked(useAdminMonitorData).mockReturnValue(emptyData as any);
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false, media: "", onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    } as any);

    renderWithProviders(<AdminMonitorPage />);
    expect(screen.queryByText("GET http://api/health")).not.toBeInTheDocument();
    expect(screen.getByText("Health Check")).toBeInTheDocument();
  });
});
