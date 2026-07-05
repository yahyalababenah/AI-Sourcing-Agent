import { describe, expect, it, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { RFQCreatePage } from "../RFQCreatePage";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types/auth";

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

const CLIENT_USER = {
  id: "u1",
  email: "importer@example.com",
  full_name: "محمد المستورد",
  role: "client",
  phone: "+962799999999",
} as User;

describe("RFQCreatePage switcher", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ user: null, role: null });
  });

  it("shows the structured desktop form for a client role at >=1024px", () => {
    useAuthStore.setState({ role: "client", user: CLIENT_USER });
    mockMatchMedia(true);
    const { container } = renderWithProviders(<RFQCreatePage />);

    expect(screen.getByText(/اسم المنتج/)).toBeInTheDocument();
    // Desktop-only: wide form column + sticky estimate column.
    expect(container.querySelector('[class*="lg:grid-cols-"]')).toBeInTheDocument();
  });

  it("shows the structured mobile form for a client role below 1024px", () => {
    useAuthStore.setState({ role: "client", user: CLIENT_USER });
    mockMatchMedia(false);
    const { container } = renderWithProviders(<RFQCreatePage />);

    expect(screen.getByText(/اسم المنتج/)).toBeInTheDocument();
    expect(container.querySelector('[class*="lg:grid-cols-"]')).not.toBeInTheDocument();
  });

  it("keeps the free-text legacy form for a non-client role", () => {
    useAuthStore.setState({ role: "agent", user: null });
    mockMatchMedia(true);
    renderWithProviders(<RFQCreatePage />);

    expect(screen.getByPlaceholderText("اكتب وصف المنتجات المطلوبة بالتفصيل...")).toBeInTheDocument();
    expect(screen.queryByText(/اسم المنتج/)).not.toBeInTheDocument();
  });
});
