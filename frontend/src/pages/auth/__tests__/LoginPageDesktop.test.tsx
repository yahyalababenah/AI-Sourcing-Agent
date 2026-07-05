import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { LoginPageDesktop } from "../LoginPageDesktop";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth");

describe("LoginPageDesktop — submit button reflects the selected role's color", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({ login: vi.fn().mockResolvedValue(undefined) } as any);
  });

  it("defaults to the importer navy for the client tab", () => {
    renderWithProviders(<LoginPageDesktop />);
    expect(screen.getByRole("button", { name: "تسجيل الدخول" })).toHaveClass("bg-importer-500");
  });

  it("switches to supplier green when the agent tab is selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPageDesktop />);

    await user.click(screen.getByRole("button", { name: "مورد" }));

    expect(screen.getByRole("button", { name: "تسجيل الدخول" })).toHaveClass("bg-supplier-500");
  });

  it("switches to slate for the admin tab", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPageDesktop />);

    await user.click(screen.getByRole("button", { name: "الإدارة" }));

    expect(screen.getByRole("button", { name: "تسجيل الدخول" })).toHaveClass("bg-slate-800");
  });
});
