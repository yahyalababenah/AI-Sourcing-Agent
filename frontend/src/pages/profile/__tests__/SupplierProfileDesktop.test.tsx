import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SupplierProfileDesktop } from "../SupplierProfileDesktop";
import { intakeService } from "@/services/intakeService";
import { quotationService } from "@/services/quotationService";
import { catalogService } from "@/services/catalogService";
import { useAuthStore } from "@/stores/authStore";
import type { RFQListResponse } from "@/types/intake";
import type { QuotationListResponse } from "@/types/quotes";
import type { CatalogProduct } from "@/types/catalog";

vi.mock("@/services/intakeService");
vi.mock("@/services/quotationService");
vi.mock("@/services/catalogService");

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
      agent_id: "agent-1",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-05T00:00:00Z",
    },
  ],
  total: 1,
  page: 1,
  page_size: 100,
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

const PRODUCTS: CatalogProduct[] = [
  {
    id: "p1",
    product_name: "خط إنتاج إضاءة LED",
    model_number: null,
    unit_price_rmb: 4200,
    moq: 100,
    weight_kg: 5,
    dimensions: null,
    material: null,
    category: null,
    hs_code: null,
    supplier_id: "agent-1",
    supplier_name: "Future Factory",
    factory_name: "Future Factory Ltd",
    location_in_china: "Shenzhen",
    document_id: null,
    document_file_name: null,
    extracted_at: null,
  },
];

describe("SupplierProfileDesktop", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: "agent-1",
        email: "agent@example.com",
        full_name: "أحمد",
        role: "agent",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        profile: {
          factory_name: "Future Factory Ltd",
          location_in_china: "Shenzhen",
          specialty: "إضاءة صناعية",
          verification_status: "verified",
        },
      } as any,
      role: "agent",
    });
    vi.mocked(intakeService.list).mockResolvedValue(RFQ_LIST);
    vi.mocked(quotationService.list).mockResolvedValue(QUOTE_LIST);
    vi.mocked(catalogService.search).mockResolvedValue({ items: PRODUCTS, total: 1, page: 1, page_size: 24, total_pages: 1 });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null, role: null });
    vi.restoreAllMocks();
  });

  it("renders the factory name, verified + ISO badges, and honest KPI stats derived from real RFQs/quotes", async () => {
    renderWithProviders(<SupplierProfileDesktop />);

    expect(await screen.findByText("Future Factory Ltd")).toBeInTheDocument();
    expect(screen.getByText("مورد موثّق")).toBeInTheDocument();
    expect(screen.getByText("ISO 9001")).toBeInTheDocument();
    expect(screen.getByText("0.82%")).toBeInTheDocument();
    expect(await screen.findByText("1")).toBeInTheDocument(); // one closed deal
  });

  it("shows the products tab with a 'طلب عرض' button per tile by default", async () => {
    renderWithProviders(<SupplierProfileDesktop />);
    expect(await screen.findByText("طلب عرض")).toBeInTheDocument();
  });

  it("switches to the 'لقطات المصنع' tab showing an honest zero RFQ count", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SupplierProfileDesktop />);

    await screen.findByText("Future Factory Ltd");
    await user.click(screen.getByText("لقطات المصنع"));

    expect(await screen.findByText("0 طلب سعر")).toBeInTheDocument();
  });
});
