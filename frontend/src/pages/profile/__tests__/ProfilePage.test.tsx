import { describe, expect, it, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ProfilePage } from "../ProfilePage";
import { api } from "@/lib/api";
import { intakeService } from "@/services/intakeService";
import { quotationService } from "@/services/quotationService";
import { catalogService } from "@/services/catalogService";
import { useAuthStore } from "@/stores/authStore";

vi.mock("@/lib/api");
vi.mock("@/services/intakeService");
vi.mock("@/services/quotationService");
vi.mock("@/services/catalogService");

describe("ProfilePage role gateway", () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, role: null });
    vi.restoreAllMocks();
  });

  it("renders the importer showcase (ClientProfilePage, T7.1) for the client role", async () => {
    useAuthStore.setState({
      user: {
        id: "client-1",
        email: "client@example.com",
        full_name: "علي",
        role: "client",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        profile: { company_name: "شركة المستقبل للتجارة", preferred_port: "Aqaba" },
      } as any,
      role: "client",
    });
    vi.mocked(intakeService.list).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
    vi.mocked(quotationService.list).mockResolvedValue({ items: [], total: 0 });

    renderWithProviders(<ProfilePage />);
    expect(await screen.findByText("شركة المستقبل للتجارة")).toBeInTheDocument();
    expect(screen.getByText("مستورد موثّق")).toBeInTheDocument();
  });

  it("renders the supplier showcase (SupplierProfilePage, T7.2) for the agent role", async () => {
    useAuthStore.setState({
      user: {
        id: "agent-1",
        email: "agent@example.com",
        full_name: "أحمد",
        role: "agent",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        profile: { factory_name: "Future Factory Ltd", location_in_china: "Shenzhen", verification_status: "verified" },
      } as any,
      role: "agent",
    });
    vi.mocked(intakeService.list).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
    vi.mocked(quotationService.list).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(catalogService.search).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 24, total_pages: 0 });

    renderWithProviders(<ProfilePage />);
    expect(await screen.findByText("Future Factory Ltd")).toBeInTheDocument();
    expect(screen.getByText("مورد موثّق")).toBeInTheDocument();
    expect(screen.queryByText("بيانات المورد")).not.toBeInTheDocument(); // legacy form heading, no longer shown
  });

  it("keeps the legacy settings-style form for the admin role (no showcase spec exists)", async () => {
    useAuthStore.setState({
      user: { id: "admin-1", email: "admin@example.com", full_name: "مدير", role: "admin" } as any,
      role: "admin",
    });
    vi.mocked(api.get).mockResolvedValue({
      data: { id: "admin-1", email: "admin@example.com", full_name: "مدير", role: "admin", is_active: true },
    } as any);

    renderWithProviders(<ProfilePage />);
    expect(await screen.findByText("المعلومات الأساسية")).toBeInTheDocument();
    expect(screen.queryByText("مستورد موثّق")).not.toBeInTheDocument();
  });
});
