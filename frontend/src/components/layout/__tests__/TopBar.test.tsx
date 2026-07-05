import { describe, expect, it } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { TopBar } from "../TopBar";
import { useUIStore } from "@/stores/uiStore";
import "@/lib/i18n";

describe("TopBar", () => {
  it("shows the ☰ button, app title, and avatar", () => {
    renderWithProviders(<TopBar />);
    expect(screen.getByLabelText("menu")).toBeInTheDocument();
    expect(screen.getByText("مركز التوريد الذكي")).toBeInTheDocument();
    expect(screen.getByText("U")).toBeInTheDocument();
  });

  it("opens the mobile drawer when ☰ is clicked", () => {
    useUIStore.setState({ drawerOpen: false });
    renderWithProviders(<TopBar />);
    fireEvent.click(screen.getByLabelText("menu"));
    expect(useUIStore.getState().drawerOpen).toBe(true);
  });
});
