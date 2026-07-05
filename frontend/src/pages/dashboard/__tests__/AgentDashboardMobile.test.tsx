import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AgentDashboardMobile } from "../AgentDashboardMobile";
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

describe("AgentDashboardMobile", () => {
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

  it("renders only 3 KPI stat cards, per CLAUDE.md's compact mobile pattern", () => {
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

    renderWithProviders(<AgentDashboardMobile />);

    expect(screen.getByText("طلبات نشطة")).toBeInTheDocument();
    expect(screen.getByText("في انتظار العرض")).toBeInTheDocument();
    expect(screen.getByText("مكتملة الأسبوع")).toBeInTheDocument();
    expect(screen.queryByText("إيرادات الشهر")).not.toBeInTheDocument();
  });

  it("shows the awaiting-reply banner with the open-RFQ count when there are open RFQs", () => {
    vi.mocked(useAgentDashboardData).mockReturnValue({
      columns: { open: [], processing: [], quoted: [], closed: [] },
      productsMap: {},
      stats: [],
      awaitingReply: [rfq({ id: "a" }), rfq({ id: "b" })],
    });

    renderWithProviders(<AgentDashboardMobile />);

    expect(screen.getByText("طلبات تنتظر ردّك")).toBeInTheDocument();
    expect(screen.getByText(/لديك 2 طلبات تنتظر ردّك/)).toBeInTheDocument();
    expect(screen.getByText("عرض الطلبات الواردة")).toBeInTheDocument();
  });

  it("hides the awaiting-reply banner when there are no open RFQs", () => {
    vi.mocked(useAgentDashboardData).mockReturnValue({
      columns: { open: [], processing: [], quoted: [], closed: [] },
      productsMap: {},
      stats: [],
      awaitingReply: [],
    });

    renderWithProviders(<AgentDashboardMobile />);

    expect(screen.queryByText("طلبات تنتظر ردّك")).not.toBeInTheDocument();
  });

  it("renders the 4 Kanban columns with their StatusPill labels", () => {
    vi.mocked(useAgentDashboardData).mockReturnValue({
      columns: { open: [rfq()], processing: [], quoted: [], closed: [] },
      productsMap: {},
      stats: [],
      awaitingReply: [],
    });

    renderWithProviders(<AgentDashboardMobile />);

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

    renderWithProviders(<AgentDashboardMobile />);

    expect(await screen.findByText(/رفع الفيديو غير متاح بعد/)).toBeInTheDocument();
    expect(await screen.findByText("0 طلب سعر")).toBeInTheDocument();
  });
});
