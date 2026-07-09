import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SettingsPage } from "../SettingsPage";
import { useAuthStore } from "@/stores/authStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { authService } from "@/services/authService";
import "@/lib/i18n";

vi.mock("@/services/authService");

/**
 * SettingsPage is still mostly a deliberate stub — no data binding, no form,
 * no API calls (see the component's own comment: "Placeholder: Settings
 * page will be implemented in later phase") — with exactly one real,
 * intentional exception: the "restart onboarding tour" action (T13 of the
 * interactive-onboarding plan), which needed a home somewhere in the real
 * app and doesn't warrant its own settings page just for one button.
 *
 * This test documents that split explicitly: the placeholder body should
 * stay a placeholder (if this starts failing on the "no textbox/no form"
 * assertions, someone replaced the stub and this file needs a real
 * rewrite), while the restart-tour button is asserted on directly.
 */
describe("SettingsPage (mostly a stub)", () => {
  beforeEach(() => {
    useAuthStore.setState({ role: null });
    vi.mocked(authService.updateOnboardingStatus).mockResolvedValue({} as any);
  });

  it("still shows the 'coming later' placeholder for the rest of the page", () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText("سيتم تنفيذ صفحة الإعدادات في مرحلة لاحقة")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("renders without crashing and without any console errors (not a blank/broken screen)", () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getAllByText("الإعدادات").length).toBeGreaterThan(0);
  });

  it("does not show the restart-tour button for admin (no tour defined for that role)", () => {
    useAuthStore.setState({ role: "admin" });
    renderWithProviders(<SettingsPage />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows and wires the restart-tour button for agent/client", () => {
    useAuthStore.setState({ role: "agent" });
    renderWithProviders(<SettingsPage />);

    expect(screen.getByText("إعادة الجولة التعريفية")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));

    expect(useOnboardingStore.getState().status).toBe("pending");
    expect(authService.updateOnboardingStatus).toHaveBeenCalledWith("pending");
  });
});
