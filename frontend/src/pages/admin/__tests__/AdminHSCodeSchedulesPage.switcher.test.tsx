import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AdminHSCodeSchedulesPage } from "../AdminHSCodeSchedulesPage";
import { useHsCodeSchedulesData } from "../useHsCodeSchedulesData";

vi.mock("../useHsCodeSchedulesData");

const baseData = {
  entries: [
    {
      id: "h1",
      hs_code: "85241210000",
      duty_rate_001: 5,
      service_flat_fee_301: 150,
      service_percent_070: 2,
      requires_license: false,
      penalty_rate_018: 0,
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

// CLAUDE.md forbids one responsive file for a screen — AdminHSCodeSchedulesPage
// must pick between two genuinely separate desktop/mobile files.
describe("AdminHSCodeSchedulesPage — desktop/mobile file switcher", () => {
  it("renders the desktop table headers when the viewport matches desktop", () => {
    vi.mocked(useHsCodeSchedulesData).mockReturnValue(baseData as any);
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true, media: "", onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    } as any);

    renderWithProviders(<AdminHSCodeSchedulesPage />);
    expect(screen.getByText("الإجراءات")).toBeInTheDocument();
  });

  it("renders the mobile stacked cards (no table headers) when the viewport doesn't match desktop", () => {
    vi.mocked(useHsCodeSchedulesData).mockReturnValue(baseData as any);
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false, media: "", onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    } as any);

    renderWithProviders(<AdminHSCodeSchedulesPage />);
    expect(screen.queryByText("الإجراءات")).not.toBeInTheDocument();
    expect(screen.getByText("85241210000")).toBeInTheDocument();
  });
});
