import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AgentDashboardDesktop } from "../AgentDashboardDesktop";
import { useAgentDashboardData } from "../useAgentDashboardData";
import { catalogService } from "@/services/catalogService";
import { useAuthStore } from "@/stores/authStore";

vi.mock("../useAgentDashboardData");
vi.mock("@/services/catalogService");

const rfq = (overrides: Partial<any> = {}): any => ({
  id: "rfq-1",
  client_name: "شركة الأمل",
  client_request_arabic: "المنتج: مصابيح LED",
  target_currency: "JOD",
  status: "open",
  exclusive_deadline: null,
  ...overrides,
});

describe("AgentDashboardDesktop", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: "agent-1", email: "agent@example.com", full_name: "أحمد", role: "agent" } as any,
      role: "agent",
    });
    vi.mocked(catalogService.search).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 4,
      total_pages: 0,
    });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null, role: null });
  });

  it("renders the 4 KPI stat cards with real values", () => {
    vi.mocked(useAgentDashboardData).mockReturnValue({
      columns: { open: [], processing: [], quoted: [], closed: [] },
      productsMap: {},
      stats: [
        { label: "طلبات نشطة", value: 5, accent: false },
        { label: "في انتظار العرض", value: 2, accent: false },
        { label: "مكتملة الأسبوع", value: 3, accent: false },
        { label: "إيرادات الشهر", value: "JOD 1,200", accent: true },
      ],
      awaitingReply: [],
    });

    renderWithProviders(<AgentDashboardDesktop />);

    expect(screen.getByText("طلبات نشطة")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("JOD 1,200")).toBeInTheDocument();
  });

  it("shows the awaiting-reply strip with the open-RFQ count and client chips", () => {
    const open = [rfq({ id: "a" }), rfq({ id: "b", client_name: "مصنع النور" })];
    vi.mocked(useAgentDashboardData).mockReturnValue({
      // Kanban columns intentionally left empty here — this test only
      // exercises the awaiting-reply strip, not the card rendering below it.
      columns: { open: [], processing: [], quoted: [], closed: [] },
      productsMap: {},
      stats: [],
      awaitingReply: open,
    });

    renderWithProviders(<AgentDashboardDesktop />);

    expect(screen.getByText("طلبات عروض أسعار تنتظر ردّك")).toBeInTheDocument();
    expect(screen.getByText(/2 طلب بانتظار الرد/)).toBeInTheDocument();
    expect(screen.getByText(/مصنع النور/)).toBeInTheDocument();
  });

  it("hides the awaiting-reply strip when there are no open RFQs", () => {
    vi.mocked(useAgentDashboardData).mockReturnValue({
      columns: { open: [], processing: [], quoted: [], closed: [] },
      productsMap: {},
      stats: [],
      awaitingReply: [],
    });

    renderWithProviders(<AgentDashboardDesktop />);

    expect(screen.queryByText("طلبات عروض أسعار تنتظر ردّك")).not.toBeInTheDocument();
  });

  it("renders the 4 Kanban columns with their StatusPill labels", () => {
    vi.mocked(useAgentDashboardData).mockReturnValue({
      columns: { open: [rfq()], processing: [], quoted: [], closed: [] },
      productsMap: {},
      stats: [],
      awaitingReply: [],
    });

    renderWithProviders(<AgentDashboardDesktop />);

    expect(screen.getByText("قيد الانتظار")).toBeInTheDocument();
    expect(screen.getByText("تحت المراجعة")).toBeInTheDocument();
    expect(screen.getByText("جارٍ التفاوض")).toBeInTheDocument();
    expect(screen.getByText("مكتمل")).toBeInTheDocument();
  });

  it("shows the reels disclaimer and an honest zero RFQ count, never a fabricated one", async () => {
    vi.mocked(useAgentDashboardData).mockReturnValue({
      columns: { open: [], processing: [], quoted: [], closed: [] },
      productsMap: {},
      stats: [],
      awaitingReply: [],
    });
    vi.mocked(catalogService.search).mockResolvedValue({
      items: [{ id: "p1", product_name: "مصباح LED", unit_price_rmb: 12, moq: 100 } as any],
      total: 1,
      page: 1,
      page_size: 4,
      total_pages: 1,
    });

    renderWithProviders(<AgentDashboardDesktop />);

    expect(
      await screen.findByText(/رفع الفيديو غير متاح بعد/)
    ).toBeInTheDocument();
    expect(await screen.findByText("0 طلب سعر")).toBeInTheDocument();
  });
});
