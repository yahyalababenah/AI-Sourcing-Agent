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
  it("renders nothing when closed", () => {
    useUIStore.setState({ drawerOpen: false });
    renderWithProviders(<MobileDrawer role="agent" />);
    expect(screen.queryByRole("button", { name: "إغلاق" })).not.toBeInTheDocument();
  });

  it("shows the sidebar content, a close button, and logout when open", () => {
    useUIStore.setState({ drawerOpen: true });
    renderWithProviders(<MobileDrawer role="agent" />);

    expect(screen.getByRole("button", { name: "إغلاق" })).toBeInTheDocument();
    expect(screen.getByText("السوق العالمي")).toBeInTheDocument();
    expect(screen.getByText("تسجيل الخروج")).toBeInTheDocument();
  });

  it("closes on overlay click and on close-button click", () => {
    useUIStore.setState({ drawerOpen: true });
    const { container } = renderWithProviders(<MobileDrawer role="agent" />);

    fireEvent.click(container.querySelector('[aria-hidden="true"]')!);
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
