import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AgentDashboard } from "../AgentDashboard";
import { useAgentDashboardData } from "../useAgentDashboardData";
import { catalogService } from "@/services/catalogService";

vi.mock("../useAgentDashboardData");
vi.mock("@/services/catalogService");

// CLAUDE.md forbids one responsive file for a screen — AgentDashboard must
// pick between two genuinely separate desktop/mobile files.
describe("AgentDashboard — desktop/mobile file switcher", () => {
  const emptyData = {
    columns: { open: [], processing: [], quoted: [], closed: [] },
    productsMap: {},
    stats: [],
    awaitingReply: [],
  };

  beforeEach(() => {
    vi.mocked(useAgentDashboardData).mockReturnValue(emptyData as any);
    vi.mocked(catalogService.search).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 4,
      total_pages: 0,
    } as any);
  });

  it("renders the desktop layout's factory-reels section when the viewport matches desktop", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true, media: "", onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    } as any);

    renderWithProviders(<AgentDashboard />);
    expect(screen.getByText("أستوديو لقطات المصنع")).toBeInTheDocument();
  });

  it("renders the mobile layout (its own reels section, no desktop quick-create header) when the viewport doesn't match desktop", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false, media: "", onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    } as any);

    renderWithProviders(<AgentDashboard />);
    // T3.2 gives mobile its own real reels section (not absent) — the file
    // switcher is verified instead by the desktop-only quick-create header.
    expect(screen.getByText("أستوديو لقطات المصنع")).toBeInTheDocument();
    expect(screen.queryByText("+ طلب جديد")).not.toBeInTheDocument();
    expect(screen.getByText("إدارة الطلبات")).toBeInTheDocument();
  });
});
