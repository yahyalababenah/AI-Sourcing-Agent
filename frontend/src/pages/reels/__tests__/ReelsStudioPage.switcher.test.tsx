import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ReelsStudioPage } from "../ReelsStudioPage";
import { catalogService } from "@/services/catalogService";
import { useAuthStore } from "@/stores/authStore";

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

describe("ReelsStudioPage switcher", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: "agent-1", email: "a@a.com", full_name: "أحمد", role: "agent" } as any,
      role: "agent",
    });
    vi.mocked(catalogService.search).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 24, total_pages: 0 });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null, role: null });
    vi.restoreAllMocks();
  });

  it("renders the desktop tile-grid layout at >=1024px", async () => {
    mockMatchMedia(true);
    renderWithProviders(<ReelsStudioPage />);
    expect(await screen.findByText("أستوديو اللقطات")).toBeInTheDocument();
    // Desktop-only search input from the (still temporary) tile-grid gallery.
    expect(screen.getByPlaceholderText("ابحث في منتجاتك...")).toBeInTheDocument();
  });

  it("renders the mobile full-screen player layout below 1024px", async () => {
    mockMatchMedia(false);
    renderWithProviders(<ReelsStudioPage />);
    // Mobile has no search input — it's a one-at-a-time player, not a gallery.
    expect(await screen.findByText("لا توجد منتجات بعد")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("ابحث في منتجاتك...")).not.toBeInTheDocument();
  });
});
