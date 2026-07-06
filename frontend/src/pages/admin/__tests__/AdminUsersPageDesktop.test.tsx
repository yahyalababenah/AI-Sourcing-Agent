import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AdminUsersPageDesktop } from "../AdminUsersPageDesktop";
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
    {
      id: "u2",
      email: "importer@example.com",
      full_name: "شركة الاستيراد",
      role: "client",
      is_active: false,
      created_at: "2026-02-15T00:00:00Z",
    },
  ],
  total: 2,
  isLoading: false,
  error: null,
  roleFilter: "all" as const,
  setRoleFilter: vi.fn(),
  statusFilter: "all" as const,
  setStatusFilter: vi.fn(),
  toggleMutation: { isPending: false, variables: undefined } as any,
  handleToggle: vi.fn(),
};

describe("AdminUsersPageDesktop", () => {
  it("renders the user table with real names, emails, roles and statuses", () => {
    vi.mocked(useAdminUsersData).mockReturnValue(baseData as any);
    renderWithProviders(<AdminUsersPageDesktop />);

    expect(screen.getByText("مصنع الأمل")).toBeInTheDocument();
    expect(screen.getByText("factory@example.com")).toBeInTheDocument();
    expect(screen.getByText("مورد")).toBeInTheDocument();
    expect(screen.getByText("مستورد")).toBeInTheDocument();
    // "نشط"/"معطّل" also label the status-filter tabs, so at least the row badge must be present.
    expect(screen.getAllByText("نشط").length).toBeGreaterThan(0);
    expect(screen.getAllByText("معطّل").length).toBeGreaterThan(0);
    expect(screen.getByText("البريد الإلكتروني")).toBeInTheDocument();
  });

  it("shows a deactivate action for an active user and an activate action for an inactive one", () => {
    vi.mocked(useAdminUsersData).mockReturnValue(baseData as any);
    renderWithProviders(<AdminUsersPageDesktop />);

    expect(screen.getByText("تعطيل")).toBeInTheDocument();
    expect(screen.getByText("تفعيل")).toBeInTheDocument();
  });

  it("shows the honest empty state instead of a table when no users match the filters", () => {
    vi.mocked(useAdminUsersData).mockReturnValue({ ...baseData, users: [] } as any);
    renderWithProviders(<AdminUsersPageDesktop />);
    expect(screen.getByText("لا يوجد مستخدمون مطابقون للفلاتر الحالية")).toBeInTheDocument();
  });
});
