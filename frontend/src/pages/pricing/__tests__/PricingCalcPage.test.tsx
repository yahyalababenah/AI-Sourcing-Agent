import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import { PricingCalcPage } from "../PricingCalcPage";
import { intakeService } from "@/services/intakeService";
import { pricingService } from "@/services/pricingService";
import type { RFQListResponse, Product } from "@/types/intake";
import type { CalculatePriceResponse } from "@/types/pricing";

vi.mock("@/services/intakeService");
vi.mock("@/services/pricingService");
vi.mock("@/services/quotationService");

const RFQ_LIST: RFQListResponse = {
  items: [
    {
      id: "rfq-1",
      client_name: "Ali Import Co.",
      client_request_arabic: "test",
      destination_port: "Aqaba",
      target_currency: "JOD",
      status: "open",
      is_public: false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
  total: 1,
  page: 1,
  page_size: 100,
};

const PRODUCTS: Product[] = [
  {
    id: "prod-1",
    rfq_id: "rfq-1",
    name: "Industrial LED Floodlight",
    quantity: 100,
    status: "pending",
    created_at: "2026-01-01T00:00:00Z",
  },
];

const CALC_RESULT: CalculatePriceResponse = {
  rfq_id: "rfq-1",
  target_currency: "JOD",
  exchange_rate_used: 0.1047,
  line_items: [
    {
      product_id: "prod-1",
      product_name: "Industrial LED Floodlight",
      quantity: 100,
      unit_price_cny: 50,
      exchange_rate: 0.1047,
      unit_price_converted: 5.235,
      freight_cost: 75,
      insurance_cost: 5,
      cif_value: 528.5,
      customs_duty: 26.4,
      clearance_fee: 15,
      commission: 20,
      subtotal: 523.5,
      discount: 0,
      total: 664.9,
      service_flat_301: 0,
      service_percent_070: 0,
      penalty_018: 0,
      hs_code_matched: false,
    },
  ],
  subtotal_before_vat: 664.9,
  vat: 88.7,
  early_payment_discount: 0,
  grand_total: 753.6,
  discount_total: 0,
  rules_applied: ["exchange_rate:cny_usd=0.14"],
};

describe("PricingCalcPage", () => {
  beforeEach(() => {
    vi.mocked(intakeService.list).mockResolvedValue(RFQ_LIST);
    vi.mocked(intakeService.listProducts).mockResolvedValue(PRODUCTS);
  });

  it("shows the placeholder before an RFQ is selected", async () => {
    renderWithProviders(<PricingCalcPage />);
    expect(
      await screen.findByText("يرجى اختيار طلب عرض سعر للبدء في حساب التكلفة النهائية للاستيراد"),
    ).toBeInTheDocument();
  });

  it("loads products once an RFQ is selected from the dropdown", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PricingCalcPage />);

    const select = await screen.findByDisplayValue("-- اختر طلب عرض سعر --");
    await user.selectOptions(select, "rfq-1");

    await waitFor(() => {
      expect(intakeService.listProducts).toHaveBeenCalledWith("rfq-1");
    });
    expect(await screen.findByText("Industrial LED Floodlight")).toBeInTheDocument();
  });

  it("calculates pricing and displays the result summary", async () => {
    vi.mocked(pricingService.calculate).mockResolvedValue(CALC_RESULT);
    const user = userEvent.setup();
    renderWithProviders(<PricingCalcPage />);

    const select = await screen.findByDisplayValue("-- اختر طلب عرض سعر --");
    await user.selectOptions(select, "rfq-1");
    await screen.findByText("Industrial LED Floodlight");

    const portInput = screen.getByPlaceholderText("مثال: Aqaba, Jordan");
    await user.type(portInput, "Aqaba");

    await user.click(screen.getByRole("button", { name: /حساب التسعير/ }));

    await waitFor(() => {
      expect(pricingService.calculate).toHaveBeenCalledWith(
        expect.objectContaining({ rfq_id: "rfq-1", destination_port: "Aqaba" }),
      );
    });
    expect(await screen.findByText("753.60")).toBeInTheDocument(); // grand_total
  });

  it("shows an inline error instead of crashing when destination port is empty", async () => {
    const user = userEvent.setup();
    renderWithProviders(<PricingCalcPage />);

    const select = await screen.findByDisplayValue("-- اختر طلب عرض سعر --");
    await user.selectOptions(select, "rfq-1");
    await screen.findByText("Industrial LED Floodlight");

    await user.click(screen.getByRole("button", { name: /حساب التسعير/ }));

    expect(
      await screen.findByText("يرجى اختيار طلب عرض السعر وتعبئة ميناء الوصول"),
    ).toBeInTheDocument();
    expect(pricingService.calculate).not.toHaveBeenCalled();
  });
});
