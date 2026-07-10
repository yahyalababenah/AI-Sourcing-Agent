import { describe, expect, it, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { RFQCreatePageMobile } from "../RFQCreatePageMobile";
import { intakeService } from "@/services/intakeService";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types/auth";

vi.mock("@/services/intakeService");

const CLIENT_USER = {
  id: "u1",
  email: "importer@example.com",
  full_name: "محمد المستورد",
  role: "client",
  phone: "+962799999999",
} as User;

describe("RFQCreatePageMobile", () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, role: null });
  });

  it("stacks the form fields, estimate preview, and submit button in a single column", () => {
    useAuthStore.setState({ role: "client", user: CLIENT_USER });
    renderWithProviders(<RFQCreatePageMobile />);

    expect(screen.getByText(/اسم المنتج/)).toBeInTheDocument();
    expect(screen.getByText("معاينة التكلفة التقديرية")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إرسال طلب عرض السعر" })).toBeInTheDocument();
  });

  it("shows the local estimate once quantity and unit price are entered", async () => {
    useAuthStore.setState({ role: "client", user: CLIENT_USER });
    const user = userEvent.setup();
    renderWithProviders(<RFQCreatePageMobile />);

    await user.type(screen.getByPlaceholderText("500"), "50");
    await user.type(screen.getByPlaceholderText("35"), "15");

    expect(await screen.findByText("الإجمالي التقديري")).toBeInTheDocument();
  });

  it("validates required fields before submitting", async () => {
    useAuthStore.setState({ role: "client", user: CLIENT_USER });
    const user = userEvent.setup();
    renderWithProviders(<RFQCreatePageMobile />);

    await user.click(screen.getByRole("button", { name: "إرسال طلب عرض السعر" }));

    expect(await screen.findByText("يرجى إدخال اسم المنتج")).toBeInTheDocument();
    expect(intakeService.create).not.toHaveBeenCalled();
  });

  // See RFQCreatePageDesktop.test.tsx — same onboarding-anchor contract, mobile layout.
  it("marks the product name, quantity, and submit fields for the onboarding tour", () => {
    useAuthStore.setState({ role: "client", user: CLIENT_USER });
    const { container } = renderWithProviders(<RFQCreatePageMobile />);

    expect(container.querySelector('[data-tour="tour-rfq-product-name"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="tour-rfq-quantity"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tour="tour-rfq-submit"]')).toBeInTheDocument();
  });
});
