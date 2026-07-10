import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SupplierProfilePage } from "../SupplierProfilePage";
import { intakeService } from "@/services/intakeService";
import { quotationService } from "@/services/quotationService";
import { catalogService } from "@/services/catalogService";
import { useAuthStore } from "@/stores/authStore";

vi.mock("@/services/intakeService");
vi.mock("@/services/quotationService");
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

describe("SupplierProfilePage switcher", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: "agent-1",
        email: "agent@example.com",
        full_name: "أحمد",
        role: "agent",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        profile: { factory_name: "Future Factory Ltd", location_in_china: "Shenzhen", verification_status: "verified" },
      } as any,
      role: "agent",
    });
    vi.mocked(intakeService.list).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 100 });
    vi.mocked(quotationService.list).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(catalogService.search).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 24, total_pages: 0 });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null, role: null });
    vi.restoreAllMocks();
  });

  it("renders the desktop layout (المصنع الذي أمثّله sidebar) at >=1024px", async () => {
    mockMatchMedia(true);
    renderWithProviders(<SupplierProfilePage />);
    expect(await screen.findByText("المصنع الذي أمثّله")).toBeInTheDocument();
  });

  it("renders the mobile stacked layout below 1024px", async () => {
    mockMatchMedia(false);
    renderWithProviders(<SupplierProfilePage />);
    await screen.findByText("أحمد");
    expect(screen.queryByText("المصنع الذي أمثّله")).not.toBeInTheDocument();
  });
});
