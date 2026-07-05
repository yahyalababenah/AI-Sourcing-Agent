import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { LoginPage } from "../LoginPage";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth");

// CLAUDE.md forbids one responsive file for a screen — LoginPage must pick
// between two genuinely separate desktop/mobile files, not toggle layout
// with hidden/lg:block classes inside a single component.
describe("LoginPage — desktop/mobile file switcher", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ login: vi.fn() } as any);
  });

  it("renders the mobile layout (compact trust strip) when the viewport doesn't match desktop", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false, media: "", onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    } as any);

    renderWithProviders(<LoginPage />);
    expect(screen.getByText("0.82% دقة")).toBeInTheDocument();
  });

  it("renders the desktop layout (two-column brand panel) when the viewport matches desktop", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true, media: "", onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    } as any);

    renderWithProviders(<LoginPage />);
    expect(screen.getByText("0.82% دقة تقدير التكلفة")).toBeInTheDocument();
  });
});
