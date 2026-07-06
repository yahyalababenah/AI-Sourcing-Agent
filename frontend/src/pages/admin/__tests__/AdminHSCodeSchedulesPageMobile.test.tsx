import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AdminHSCodeSchedulesPageMobile } from "../AdminHSCodeSchedulesPageMobile";
import { useHsCodeSchedulesData } from "../useHsCodeSchedulesData";

vi.mock("../useHsCodeSchedulesData");

const baseData = {
  entries: [
    {
      id: "h1",
      hs_code: "85241210000",
      description: "إضاءة LED صناعية",
      duty_rate_001: 5,
      service_flat_fee_301: 150,
      service_percent_070: 2,
      requires_license: true,
      penalty_rate_018: 10,
      vat_rate_020: null,
      is_verified: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
  total: 1,
  isLoading: false,
  error: null,
  showModal: false,
  editingEntry: undefined,
  handleAdd: vi.fn(),
  handleEdit: vi.fn(),
  handleDelete: vi.fn(),
  closeModal: vi.fn(),
  deleteMutation: { isPending: false } as any,
};

describe("AdminHSCodeSchedulesPageMobile", () => {
  it("renders stacked HS-code cards (no table headers) with the same data as desktop", () => {
    vi.mocked(useHsCodeSchedulesData).mockReturnValue(baseData as any);
    renderWithProviders(<AdminHSCodeSchedulesPageMobile />);

    expect(screen.getByText("85241210000")).toBeInTheDocument();
    expect(screen.getByText("✅ مؤكد")).toBeInTheDocument();
    expect(screen.getByText("تعديل")).toBeInTheDocument();
    expect(screen.queryByText("الإجراءات")).not.toBeInTheDocument();
  });

  it("shows a loading skeleton while fetching", () => {
    vi.mocked(useHsCodeSchedulesData).mockReturnValue({ ...baseData, isLoading: true, entries: [] } as any);
    const { container } = renderWithProviders(<AdminHSCodeSchedulesPageMobile />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
