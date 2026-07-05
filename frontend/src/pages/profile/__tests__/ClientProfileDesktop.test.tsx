import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ClientProfileDesktop } from "../ClientProfileDesktop";
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
      id: "rfq-1",
      client_name: "Ali Import Co.",
      client_request_arabic: "طلب شراء: خط إنتاج إضاءة LED",
      destination_port: "Aqaba",
      target_currency: "JOD",
      status: "closed",
      is_public: false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-05T00:00:00Z",
    },
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
  total: 2,
  page: 1,
  page_size: 50,
};

const QUOTE_LIST: QuotationListResponse = {
  items: [
    {
      id: "q-1",
      rfq_id: "rfq-1",
      agent_id: "agent-1",
      quotation_number: "Q-0001",
      status: "finalized",
      target_currency: "JOD",
      exchange_rate_used: 0.14,
      subtotal: 8000,
      grand_total: 8400,
      created_at: "2026-01-02T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    },
  ],
  total: 1,
};

describe("ClientProfileDesktop", () => {
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
    vi.mocked(quotationService.list).mockResolvedValue(QUOTE_LIST);
  });

  afterEach(() => {
    useAuthStore.setState({ user: null, role: null });
    vi.restoreAllMocks();
  });

  it("renders the company name, verified badge, and honest KPI stats derived from real RFQs/quotes", async () => {
    renderWithProviders(<ClientProfileDesktop />);

    expect(await screen.findByText("شركة المستقبل للتجارة")).toBeInTheDocument();
    expect(screen.getByText("مستورد موثّق")).toBeInTheDocument();
    expect(await screen.findByText("$8,400")).toBeInTheDocument(); // avg of the one closed deal's quote
    expect(screen.getByText("1")).toBeInTheDocument(); // one closed RFQ
    expect(screen.getAllByText("Aqaba").length).toBeGreaterThan(0);
  });

  it("shows an honest empty state for saved/followed items — no persisted bookmark backend exists", async () => {
    renderWithProviders(<ClientProfileDesktop />);
    await screen.findByText("شركة المستقبل للتجارة");
    expect(screen.getByText("لا توجد عناصر محفوظة بعد")).toBeInTheDocument();
  });

  it("opens the edit form when 'تعديل الملف' is clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderWithProviders(<ClientProfileDesktop />);

    await screen.findByText("شركة المستقبل للتجارة");
    await user.click(screen.getByText("تعديل الملف"));

    expect(await screen.findByText("تعديل بيانات الشركة")).toBeInTheDocument();
  });
});
