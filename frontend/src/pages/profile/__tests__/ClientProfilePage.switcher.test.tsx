import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ClientProfilePage } from "../ClientProfilePage";
import { intakeService } from "@/services/intakeService";
import { quotationService } from "@/services/quotationService";
import { useAuthStore } from "@/stores/authStore";

vi.mock("@/services/intakeService");
vi.mock("@/services/quotationService");

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

describe("ClientProfilePage switcher", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: "client-1",
        email: "client@example.com",
        full_name: "علي",
        role: "client",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        profile: { company_name: "شركة المستقبل للتجارة", preferred_port: "Aqaba" },
      } as any,
      role: "client",
    });
    vi.mocked(intakeService.list).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
    vi.mocked(quotationService.list).mockResolvedValue({ items: [], total: 0 });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null, role: null });
    vi.restoreAllMocks();
  });

  it("renders the desktop layout (بيانات الشركة sidebar) at >=1024px", async () => {
    mockMatchMedia(true);
    renderWithProviders(<ClientProfilePage />);
    expect(await screen.findByText("بيانات الشركة")).toBeInTheDocument();
  });

  it("renders the mobile segmented switcher below 1024px", async () => {
    mockMatchMedia(false);
    renderWithProviders(<ClientProfilePage />);
    expect(await screen.findByText("طلباتي النشطة")).toBeInTheDocument();
    expect(screen.queryByText("بيانات الشركة")).not.toBeInTheDocument();
  });
});
