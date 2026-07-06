import { describe, expect, it, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { MarketplacePage } from "../MarketplacePage";
import { catalogService } from "@/services/catalogService";
import type { CatalogListResponse } from "@/types/catalog";

vi.mock("@/services/catalogService");

function mockMatchMedia(matchesDesktop: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: query.includes("1024") ? matchesDesktop : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const EMPTY: CatalogListResponse = { items: [], total: 0, page: 1, page_size: 12, total_pages: 0 };

describe("MarketplacePage switcher", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the always-visible filter sidebar at >=1024px", async () => {
    vi.mocked(catalogService.search).mockResolvedValue(EMPTY);
    mockMatchMedia(true);
    renderWithProviders(<MarketplacePage />);

    // The desktop sidebar renders "الفئة" immediately, with no "فلاتر"
    // toggle button needed — the mobile page instead requires opening the
    // overlay first.
    expect(await screen.findByText("الفئة")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /فلاتر/ })).not.toBeInTheDocument();
  });

  it("hides filters behind a 'فلاتر' toggle button below 1024px", async () => {
    vi.mocked(catalogService.search).mockResolvedValue(EMPTY);
    mockMatchMedia(false);
    renderWithProviders(<MarketplacePage />);

    await screen.findByText("سوق الموردين");
    expect(screen.queryByText("الفئة")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /فلاتر/ })).toBeInTheDocument();
  });
});
