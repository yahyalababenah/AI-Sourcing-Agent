import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AdminLoginPage } from "../AdminLoginPage";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth");

describe("AdminLoginPage — dedicated admin entry point", () => {
  const login = vi.fn();

  beforeEach(() => {
    login.mockReset().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({ login } as any);
  });

  it("renders with admin demo credentials pre-filled", () => {
    renderWithProviders(<AdminLoginPage />);
    expect(screen.getByDisplayValue("admin@example.com")).toBeInTheDocument();
    expect(screen.getByText("لوحة الإدارة")).toBeInTheDocument();
  });

  it("submits the admin credentials on login", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminLoginPage />);

    await user.click(screen.getByRole("button", { name: "تسجيل الدخول" }));

    expect(login).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "password123",
    });
  });

  it("provides a link back to the main (role-tabbed) login page", () => {
    renderWithProviders(<AdminLoginPage />);
    expect(screen.getByRole("link", { name: "العودة إلى بوابة المستخدمين" })).toBeInTheDocument();
  });
});
