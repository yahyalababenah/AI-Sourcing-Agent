import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { LoginPage } from "../LoginPage";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth");

describe("LoginPage — role tabs (client / agent / admin)", () => {
  const login = vi.fn();

  beforeEach(() => {
    login.mockReset().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({ login } as any);
  });

  it("defaults to the client tab with the client demo email", () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole("button", { name: "مستورد" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("client@example.com")).toBeInTheDocument();
  });

  it("switching to the agent tab autofills the agent demo email", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "مورد" }));

    expect(screen.getByDisplayValue("agent@example.com")).toBeInTheDocument();
  });

  it("switching to the admin tab autofills its demo email", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "الإدارة" }));

    expect(screen.getByDisplayValue("admin@example.com")).toBeInTheDocument();
  });

  it("submits the currently active tab's email and entered password", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "مورد" }));
    const passwordInput = screen.getByPlaceholderText("••••••••");
    await user.clear(passwordInput);
    await user.type(passwordInput, "MyPassword123!");

    await user.click(screen.getByRole("button", { name: "تسجيل الدخول" }));

    expect(login).toHaveBeenCalledWith({
      email: "agent@example.com",
      password: "MyPassword123!",
    });
  });

  it("shows a loading state while the login request is in flight", async () => {
    let resolveLogin: () => void;
    login.mockReturnValue(new Promise<void>((resolve) => { resolveLogin = resolve; }));
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "تسجيل الدخول" }));

    expect(await screen.findByRole("button", { name: "جاري الدخول..." })).toBeDisabled();
    resolveLogin!();
  });

  it("does not crash when login rejects (error toast handled by useAuth)", async () => {
    login.mockRejectedValue(new Error("Invalid credentials"));
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "تسجيل الدخول" }));

    expect(await screen.findByRole("button", { name: "تسجيل الدخول" })).toBeInTheDocument();
  });
});
