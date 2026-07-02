import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { RegisterPage } from "../RegisterPage";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth");

async function fillCommonFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("الاسم الكامل"), "Ahmed Ali");
  await user.type(screen.getByLabelText("البريد الإلكتروني"), "ahmed@example.com");
  await user.type(screen.getByLabelText("كلمة المرور"), "Secure@123");
  await user.type(screen.getByLabelText("تأكيد كلمة المرور"), "Secure@123");
}

describe("RegisterPage — role-specific profile fields (TESTING_FINDINGS.md #0d)", () => {
  const register = vi.fn();

  beforeEach(() => {
    register.mockReset().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({ register } as any);
  });

  it("registers a client successfully once company_name is filled", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await user.click(screen.getByRole("button", { name: /عميل/ }));
    await fillCommonFields(user);
    await user.type(screen.getByLabelText("اسم الشركة"), "Acme Trading Co.");

    await user.click(screen.getByRole("button", { name: "إنشاء حساب" }));

    expect(register).toHaveBeenCalledWith({
      email: "ahmed@example.com",
      password: "Secure@123",
      full_name: "Ahmed Ali",
      phone: undefined,
      role: "client",
      company_name: "Acme Trading Co.",
    });
  });

  it("registers an agent successfully once factory_name and location_in_china are filled", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    // Agent is the default active tab.
    await fillCommonFields(user);
    await user.type(screen.getByLabelText("اسم المصنع"), "Future Factory Ltd");
    await user.type(screen.getByLabelText("موقع المصنع في الصين"), "Guangzhou, Guangdong");

    await user.click(screen.getByRole("button", { name: "إنشاء حساب" }));

    expect(register).toHaveBeenCalledWith({
      email: "ahmed@example.com",
      password: "Secure@123",
      full_name: "Ahmed Ali",
      phone: undefined,
      role: "agent",
      factory_name: "Future Factory Ltd",
      location_in_china: "Guangzhou, Guangdong",
    });
  });

  it("shows the real Arabic error for a missing company_name on the client tab, instead of submitting", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await user.click(screen.getByRole("button", { name: /عميل/ }));
    await fillCommonFields(user);
    // company_name intentionally left blank.

    await user.click(screen.getByRole("button", { name: "إنشاء حساب" }));

    expect(await screen.findByText("يرجى إدخال اسم الشركة")).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it("shows the real Arabic error for a missing factory_name on the agent tab, instead of submitting", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    // Agent is the default active tab; factory_name/location_in_china left blank.
    await fillCommonFields(user);

    await user.click(screen.getByRole("button", { name: "إنشاء حساب" }));

    expect(await screen.findByText("يرجى إدخال اسم المصنع")).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });
});
