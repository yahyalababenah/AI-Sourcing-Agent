import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SettingsPage } from "../SettingsPage";

/**
 * SettingsPage is a deliberate stub — no data binding, no form, no API calls
 * (see the component's own comment: "Placeholder: Settings page will be
 * implemented in later phase"). Per the brief, this test documents that
 * stub state explicitly as a living reminder rather than a permanently
 * failing CI test: it passes today because the placeholder copy is exactly
 * what's rendered, and it will start FAILING the moment someone replaces the
 * stub with a real settings page (the placeholder text will be gone) —
 * forcing a conscious update of this test file instead of silently letting
 * a completed settings page go untested.
 */
describe("SettingsPage (stub)", () => {
  it("still shows the 'coming later' placeholder, not a real settings form", () => {
    renderWithProviders(<SettingsPage />);

    expect(screen.getByText("سيتم تنفيذ صفحة الإعدادات في مرحلة لاحقة")).toBeInTheDocument();

    // No real settings controls should exist yet — if this starts failing,
    // it means the stub has been replaced and this test file needs rewriting
    // to cover the real page instead.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("renders without crashing and without any console errors (not a blank/broken screen)", () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getAllByText("الإعدادات").length).toBeGreaterThan(0);
  });
});
