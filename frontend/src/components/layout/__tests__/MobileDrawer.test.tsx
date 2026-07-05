import { describe, expect, it, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { MobileDrawer } from "../MobileDrawer";
import { useUIStore } from "@/stores/uiStore";
import "@/lib/i18n";

const logout = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ logout }),
}));

describe("MobileDrawer", () => {
  it("is translated off-screen and non-interactive when closed (not abruptly unmounted)", () => {
    useUIStore.setState({ drawerOpen: false });
    const { container } = renderWithProviders(<MobileDrawer role="agent" />);

    const drawer = container.querySelector(".end-0")!;
    expect(drawer).toHaveClass("translate-x-full", "pointer-events-none");
    expect(drawer).toHaveAttribute("aria-hidden", "true");

    const overlay = container.querySelector(".inset-0")!;
    expect(overlay).toHaveClass("opacity-0", "pointer-events-none");
  });

  it("slides in and shows the sidebar content, a close button, and logout when open", () => {
    useUIStore.setState({ drawerOpen: true });
    const { container } = renderWithProviders(<MobileDrawer role="agent" />);

    const drawer = container.querySelector(".end-0")!;
    expect(drawer).toHaveClass("translate-x-0");
    expect(drawer).toHaveAttribute("aria-hidden", "false");

    const overlay = container.querySelector(".inset-0")!;
    expect(overlay).toHaveClass("opacity-100");

    expect(screen.getByRole("button", { name: "إغلاق" })).toBeInTheDocument();
    expect(screen.getByText("السوق العالمي")).toBeInTheDocument();
    expect(screen.getByText("تسجيل الخروج")).toBeInTheDocument();
  });

  it("closes on overlay click and on close-button click", () => {
    useUIStore.setState({ drawerOpen: true });
    const { container } = renderWithProviders(<MobileDrawer role="agent" />);

    fireEvent.click(container.querySelector(".inset-0")!);
    expect(useUIStore.getState().drawerOpen).toBe(false);

    useUIStore.setState({ drawerOpen: true });
    renderWithProviders(<MobileDrawer role="agent" />);
    fireEvent.click(screen.getAllByRole("button", { name: "إغلاق" })[0]);
    expect(useUIStore.getState().drawerOpen).toBe(false);
  });

  it("clears auth when the logout row is pressed", () => {
    useUIStore.setState({ drawerOpen: true });
    renderWithProviders(<MobileDrawer role="agent" />);

    fireEvent.click(screen.getByText("تسجيل الخروج"));
    expect(logout).toHaveBeenCalled();
  });
});
