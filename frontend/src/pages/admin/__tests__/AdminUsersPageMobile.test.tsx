import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AdminUsersPageMobile } from "../AdminUsersPageMobile";
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

describe("AdminUsersPageMobile", () => {
  it("renders stacked user cards (no table headers) with the same data as desktop", () => {
    vi.mocked(useAdminUsersData).mockReturnValue(baseData as any);
    renderWithProviders(<AdminUsersPageMobile />);

    expect(screen.getByText("مصنع الأمل")).toBeInTheDocument();
    expect(screen.getByText("factory@example.com")).toBeInTheDocument();
    // "نشط" also labels the status-filter tab, so at least the row badge must be present.
    expect(screen.getAllByText("نشط").length).toBeGreaterThan(0);
    expect(screen.getByText("تعطيل")).toBeInTheDocument();
    expect(screen.queryByText("البريد الإلكتروني")).not.toBeInTheDocument();
  });

  it("shows a loading skeleton while fetching", () => {
    vi.mocked(useAdminUsersData).mockReturnValue({ ...baseData, isLoading: true, users: [] } as any);
    const { container } = renderWithProviders(<AdminUsersPageMobile />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
