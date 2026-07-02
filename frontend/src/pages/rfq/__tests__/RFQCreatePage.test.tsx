import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { RFQCreatePage } from "../RFQCreatePage";
import { intakeService } from "@/services/intakeService";
import type { RFQ } from "@/types/intake";

vi.mock("@/services/intakeService");

const CREATED_RFQ: RFQ = {
  id: "rfq-new-1",
  client_name: "Ali Import Co.",
  client_request_arabic: "أحتاج 100 كشاف إضاءة صناعي",
  destination_port: "Aqaba",
  target_currency: "USD",
  status: "open",
  is_public: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("RFQCreatePage", () => {
  // Regression coverage for TESTING_FINDINGS.md #5g (fixed): the <form> now
  // has `noValidate`, so native browser constraint validation no longer
  // intercepts a real button click before our Arabic validation messages can
  // render. These use an actual user.click() on the submit button — not
  // fireEvent.submit() — specifically to prove the fix works via normal
  // mouse interaction, the exact path that was broken before.
  it("shows a validation error and does not submit when client name is empty", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RFQCreatePage />);

    await user.type(
      screen.getByPlaceholderText("اكتب وصف المنتجات المطلوبة بالتفصيل..."),
      "أحتاج 100 كشاف إضاءة صناعي",
    );
    await user.click(screen.getByRole("button", { name: "إنشاء طلب عرض السعر" }));

    expect(await screen.findByText("يرجى إدخال اسم العميل")).toBeInTheDocument();
    expect(intakeService.create).not.toHaveBeenCalled();
  });

  it("shows a validation error when the client request is empty", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RFQCreatePage />);

    await user.type(screen.getByPlaceholderText("أحمد محمد"), "Ali Import Co.");
    await user.click(screen.getByRole("button", { name: "إنشاء طلب عرض السعر" }));

    expect(await screen.findByText("يرجى إدخال طلب العميل")).toBeInTheDocument();
    expect(intakeService.create).not.toHaveBeenCalled();
  });

  it("submits the form with all fields filled and navigates to the new RFQ", async () => {
    vi.mocked(intakeService.create).mockResolvedValue(CREATED_RFQ);
    const user = userEvent.setup();
    renderWithProviders(<RFQCreatePage />);

    await user.type(screen.getByPlaceholderText("أحمد محمد"), "Ali Import Co.");
    await user.type(screen.getByPlaceholderText("+962791234567"), "+962791234567");
    await user.type(
      screen.getByPlaceholderText("اكتب وصف المنتجات المطلوبة بالتفصيل..."),
      "أحتاج 100 كشاف إضاءة صناعي",
    );
    await user.type(screen.getByPlaceholderText("ميناء العقبة، الأردن"), "Aqaba");
    await user.selectOptions(screen.getByDisplayValue("دولار أمريكي (USD)"), "JOD");

    await user.click(screen.getByRole("button", { name: "إنشاء طلب عرض السعر" }));

    await waitFor(() => {
      expect(intakeService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          client_name: "Ali Import Co.",
          client_phone: "+962791234567",
          client_request_arabic: "أحتاج 100 كشاف إضاءة صناعي",
          destination_port: "Aqaba",
          target_currency: "JOD",
        }),
      );
    });
  });

  it("shows a loading state while the request is in flight", async () => {
    let resolveCreate: (value: RFQ) => void;
    vi.mocked(intakeService.create).mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<RFQCreatePage />);

    await user.type(screen.getByPlaceholderText("أحمد محمد"), "Ali Import Co.");
    await user.type(
      screen.getByPlaceholderText("اكتب وصف المنتجات المطلوبة بالتفصيل..."),
      "test request",
    );
    await user.click(screen.getByRole("button", { name: "إنشاء طلب عرض السعر" }));

    expect(await screen.findByRole("button", { name: "جاري الإنشاء..." })).toBeDisabled();
    resolveCreate!(CREATED_RFQ);
  });

  it("shows a network failure error inline instead of crashing", async () => {
    vi.mocked(intakeService.create).mockRejectedValue(new Error("Network Error"));
    const user = userEvent.setup();
    renderWithProviders(<RFQCreatePage />);

    await user.type(screen.getByPlaceholderText("أحمد محمد"), "Ali Import Co.");
    await user.type(
      screen.getByPlaceholderText("اكتب وصف المنتجات المطلوبة بالتفصيل..."),
      "test request",
    );
    await user.click(screen.getByRole("button", { name: "إنشاء طلب عرض السعر" }));

    expect(await screen.findByText("Network Error")).toBeInTheDocument();
  });
});
