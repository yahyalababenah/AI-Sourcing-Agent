import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AdminUsersPage } from "../AdminUsersPage";
import { useAdminUsersData } from "../useAdminUsersData";

vi.mock("../useAdminUsersData", async () => {
  const actual = await vi.importActual<typeof import("../useAdminUsersData")>("../useAdminUsersData");
  return { ...actual, useAdminUsersData: vi.fn() };
});

const baseData = {
  users: [
    {
      id: "u1",
      email: "factory@example.com",
      full_name: "مصنع الأمل",
      role: "agent",
      is_active: true,
      created_at: "2026-01-10T00:00:00Z",
    },
  ],
  total: 1,
  isLoading: false,
  error: null,
  roleFilter: "all" as const,
  setRoleFilter: vi.fn(),
  statusFilter: "all" as const,
  setStatusFilter: vi.fn(),
  toggleMutation: { isPending: false, variables: undefined } as any,
  handleToggle: vi.fn(),
};

// CLAUDE.md forbids one responsive file for a screen — AdminUsersPage must
// pick between two genuinely separate desktop/mobile files.
describe("AdminUsersPage — desktop/mobile file switcher", () => {
  it("renders the desktop table headers when the viewport matches desktop", () => {
    vi.mocked(useAdminUsersData).mockReturnValue(baseData as any);
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true, media: "", onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    } as any);

    renderWithProviders(<AdminUsersPage />);
    expect(screen.getByText("البريد الإلكتروني")).toBeInTheDocument();
  });

  it("renders the mobile stacked cards (no table headers) when the viewport doesn't match desktop", () => {
    vi.mocked(useAdminUsersData).mockReturnValue(baseData as any);
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false, media: "", onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    } as any);

    renderWithProviders(<AdminUsersPage />);
    expect(screen.queryByText("البريد الإلكتروني")).not.toBeInTheDocument();
    expect(screen.getByText("مصنع الأمل")).toBeInTheDocument();
  });
});
