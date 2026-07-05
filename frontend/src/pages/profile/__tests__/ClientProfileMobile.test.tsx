import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ClientProfileMobile } from "../ClientProfileMobile";
import { intakeService } from "@/services/intakeService";
import { quotationService } from "@/services/quotationService";
import { useAuthStore } from "@/stores/authStore";
import type { RFQListResponse } from "@/types/intake";
import type { QuotationListResponse } from "@/types/quotes";

vi.mock("@/services/intakeService");
vi.mock("@/services/quotationService");

const RFQ_LIST: RFQListResponse = {
  items: [
    {
      id: "rfq-2",
      client_name: "Ali Import Co.",
      client_request_arabic: "طلب شراء: لوحة تحكم صناعية",
      destination_port: "Aqaba",
      target_currency: "JOD",
      status: "open",
      is_public: false,
      created_at: "2026-02-01T00:00:00Z",
      updated_at: "2026-02-01T00:00:00Z",
    },
  ],
  total: 1,
  page: 1,
  page_size: 50,
};

const EMPTY_QUOTES: QuotationListResponse = { items: [], total: 0 };

describe("ClientProfileMobile", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: "client-1",
        email: "client@example.com",
        full_name: "علي",
        role: "client",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        profile: { company_name: "شركة المستقبل للتجارة", preferred_port: "Aqaba", contact_number: "+962791234567" },
      } as any,
      role: "client",
    });
    vi.mocked(intakeService.list).mockResolvedValue(RFQ_LIST);
    vi.mocked(quotationService.list).mockResolvedValue(EMPTY_QUOTES);
  });

  afterEach(() => {
    useAuthStore.setState({ user: null, role: null });
    vi.restoreAllMocks();
  });

  it("defaults to the 'محفوظاتي' tab with an honest empty state", async () => {
    renderWithProviders(<ClientProfileMobile />);
    expect(await screen.findByText("شركة المستقبل للتجارة")).toBeInTheDocument();
    expect(screen.getByText("لا توجد عناصر محفوظة بعد")).toBeInTheDocument();
  });

  it("switches to 'طلباتي النشطة' and lists the real open RFQ with a StatusPill", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientProfileMobile />);

    await screen.findByText("شركة المستقبل للتجارة");
    await user.click(screen.getByText("طلباتي النشطة"));

    expect(await screen.findByText("لوحة تحكم صناعية")).toBeInTheDocument();
    expect(screen.getByText("قيد الانتظار")).toBeInTheDocument();
  });
});
