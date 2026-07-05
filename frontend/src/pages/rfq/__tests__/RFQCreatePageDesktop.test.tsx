import { describe, expect, it, vi, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { RFQCreatePageDesktop } from "../RFQCreatePageDesktop";
import { intakeService } from "@/services/intakeService";
import { useAuthStore } from "@/stores/authStore";
import type { RFQ } from "@/types/intake";
import type { User } from "@/types/auth";

vi.mock("@/services/intakeService");

const CLIENT_USER = {
  id: "u1",
  email: "importer@example.com",
  full_name: "محمد المستورد",
  role: "client",
  phone: "+962799999999",
} as User;

const CREATED_RFQ: RFQ = {
  id: "rfq-new-1",
  client_name: "محمد المستورد",
  client_request_arabic: "المنتج: كشافات LED\nالكمية: 500 وحدة",
  target_currency: "USD",
  status: "open",
  is_public: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("RFQCreatePageDesktop", () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, role: null });
  });

  it("shows an honest empty state for the estimate preview before quantity/price are entered", () => {
    useAuthStore.setState({ role: "client", user: CLIENT_USER });
    renderWithProviders(<RFQCreatePageDesktop />);

    expect(
      screen.getByText("أدخل الكمية والسعر المستهدف للوحدة (بالعملة الصينية) لعرض تقدير للتكلفة"),
    ).toBeInTheDocument();
  });

  it("computes a live local estimate once quantity and unit price are filled in", async () => {
    useAuthStore.setState({ role: "client", user: CLIENT_USER });
    const user = userEvent.setup();
    renderWithProviders(<RFQCreatePageDesktop />);

    await user.type(screen.getByPlaceholderText("500"), "100");
    await user.type(screen.getByPlaceholderText("35"), "20");

    expect(await screen.findByText("الإجمالي التقديري")).toBeInTheDocument();
    expect(screen.getByText("⚠️ تقدير تقريبي أولي")).toBeInTheDocument();
  });

  it("validates required fields before submitting", async () => {
    useAuthStore.setState({ role: "client", user: CLIENT_USER });
    const user = userEvent.setup();
    renderWithProviders(<RFQCreatePageDesktop />);

    await user.click(screen.getByRole("button", { name: "إرسال طلب عرض السعر" }));

    expect(await screen.findByText("يرجى إدخال اسم المنتج")).toBeInTheDocument();
    expect(intakeService.create).not.toHaveBeenCalled();
  });

  it("submits a composed request built from the structured fields", async () => {
    useAuthStore.setState({ role: "client", user: CLIENT_USER });
    vi.mocked(intakeService.create).mockResolvedValue(CREATED_RFQ);
    const user = userEvent.setup();
    renderWithProviders(<RFQCreatePageDesktop />);

    await user.type(screen.getByPlaceholderText("كشافات إضاءة LED صناعية"), "كشافات LED");
    await user.type(screen.getByPlaceholderText("500"), "500");
    await user.click(screen.getByRole("button", { name: "إرسال طلب عرض السعر" }));

    await waitFor(() => {
      expect(intakeService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          client_name: "محمد المستورد",
          client_phone: "+962799999999",
          client_request_arabic: expect.stringContaining("كشافات LED"),
          extracted_entities: expect.objectContaining({ product_name: "كشافات LED", quantity: 500 }),
        }),
      );
    });
  });
});
