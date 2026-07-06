import { describe, expect, it, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { LanguageSwitcher } from "../LanguageSwitcher";
import i18n from "@/lib/i18n";

describe("LanguageSwitcher", () => {
  afterEach(async () => {
    await i18n.changeLanguage("ar");
  });

  it("shows all three language options", () => {
    renderWithProviders(<LanguageSwitcher />);
    expect(screen.getByText("عربي")).toBeInTheDocument();
    expect(screen.getByText("EN")).toBeInTheDocument();
    expect(screen.getByText("中文")).toBeInTheDocument();
  });

  it("marks the active language as pressed", () => {
    renderWithProviders(<LanguageSwitcher />);
    expect(screen.getByText("عربي")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("EN")).toHaveAttribute("aria-pressed", "false");
  });

  it("switches the active language on click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LanguageSwitcher />);

    await user.click(screen.getByText("EN"));

    expect(screen.getByText("EN")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("عربي")).toHaveAttribute("aria-pressed", "false");
    expect(i18n.language).toBe("en");
  });
});
