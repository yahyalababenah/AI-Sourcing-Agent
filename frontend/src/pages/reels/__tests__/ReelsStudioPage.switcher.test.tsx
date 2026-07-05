import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ReelsStudioPage } from "../ReelsStudioPage";
import { catalogService } from "@/services/catalogService";
import { useAuthStore } from "@/stores/authStore";
import type { CatalogProduct } from "@/types/catalog";

vi.mock("@/services/catalogService");

const PRODUCTS: CatalogProduct[] = [
  {
    id: "p1",
    product_name: "خط إنتاج إضاءة LED",
    model_number: null,
    unit_price_rmb: 4200,
    moq: 100,
    weight_kg: 5,
    dimensions: null,
    material: null,
    category: null,
    hs_code: null,
    supplier_id: "agent-1",
    supplier_name: "Future Factory",
    factory_name: "Future Factory Ltd",
    location_in_china: null,
    document_id: null,
    document_file_name: null,
    extracted_at: null,
  },
];

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
    vi.mocked(catalogService.search).mockResolvedValue({ items: PRODUCTS, total: 1, page: 1, page_size: 24, total_pages: 1 });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null, role: null });
    vi.restoreAllMocks();
  });

  it("renders the desktop 300px-player + management-list layout at >=1024px", async () => {
    mockMatchMedia(true);
    renderWithProviders(<ReelsStudioPage />);
    expect(await screen.findByText("أستوديو لقطات المصنع")).toBeInTheDocument();
    // Desktop-only: the "كل اللقطات" management list beside the player.
    expect(screen.getByText("كل اللقطات")).toBeInTheDocument();
  });

  it("renders the mobile full-screen player layout below 1024px", async () => {
    mockMatchMedia(false);
    renderWithProviders(<ReelsStudioPage />);
    // Mobile is a one-at-a-time player — no page title, no management list.
    expect(await screen.findByText("خط إنتاج إضاءة LED")).toBeInTheDocument();
    expect(screen.queryByText("كل اللقطات")).not.toBeInTheDocument();
    expect(screen.queryByText("أستوديو لقطات المصنع")).not.toBeInTheDocument();
  });
});
