import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AdminHSCodeSchedulesPageDesktop } from "../AdminHSCodeSchedulesPageDesktop";
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
      source_note: "محاكاة JCAP",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "h2",
      hs_code: "94054000",
      duty_rate_001: 8,
      service_flat_fee_301: 150,
      service_percent_070: 2,
      requires_license: false,
      penalty_rate_018: 0,
      vat_rate_020: 16,
      is_verified: false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
  total: 2,
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

describe("AdminHSCodeSchedulesPageDesktop", () => {
  it("renders the HS code table with real fee columns and verification badges", () => {
    vi.mocked(useHsCodeSchedulesData).mockReturnValue(baseData as any);
    renderWithProviders(<AdminHSCodeSchedulesPageDesktop />);

    expect(screen.getByText("85241210000")).toBeInTheDocument();
    expect(screen.getByText("94054000")).toBeInTheDocument();
    expect(screen.getByText("✅ مؤكد")).toBeInTheDocument();
    expect(screen.getByText("⚠️ تقديري")).toBeInTheDocument();
  });

  it("shows the honest empty state instead of a table when no HS codes are added", () => {
    vi.mocked(useHsCodeSchedulesData).mockReturnValue({ ...baseData, entries: [] } as any);
    renderWithProviders(<AdminHSCodeSchedulesPageDesktop />);
    expect(screen.getByText("لا توجد رموز HS مضافة بعد")).toBeInTheDocument();
  });

  it("opens the create-entry modal", () => {
    vi.mocked(useHsCodeSchedulesData).mockReturnValue({ ...baseData, showModal: true } as any);
    renderWithProviders(<AdminHSCodeSchedulesPageDesktop />);
    expect(screen.getByText("إضافة جدول رسوم رمز HS")).toBeInTheDocument();
  });
});
