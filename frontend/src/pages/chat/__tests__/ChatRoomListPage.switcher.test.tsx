import { describe, expect, it, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ChatRoomListPage } from "../ChatRoomListPage";
import { chatService } from "@/services/chatService";
import { useAuthStore } from "@/stores/authStore";
import type { ChatRoom, RoomListResponse } from "@/types/chat";

vi.mock("@/services/chatService");

function mockMatchMedia(matchesDesktop: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: query.includes("1024") ? matchesDesktop : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const EMPTY: RoomListResponse = { items: [], total: 0 };

const ROOM: ChatRoom = {
  id: "room-1",
  rfq_id: null,
  client_id: "user-client",
  supplier_id: "user-supplier",
  status: "active",
  client_name: "Ali Import Co.",
  supplier_name: "Guangzhou Factory",
  last_message: "مرحباً",
  last_message_at: "2026-01-01T00:00:00Z",
  unread_count: 0,
  created_at: "2026-01-01T00:00:00Z",
};

describe("ChatRoomListPage switcher", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ user: null, role: null });
  });

  it("renders the two-column desktop grid at >=1024px", async () => {
    vi.mocked(chatService.listRooms).mockResolvedValue({ items: [ROOM], total: 1 });
    mockMatchMedia(true);
    const { container } = renderWithProviders(<ChatRoomListPage />);

    await screen.findByText("Ali Import Co.");
    expect(container.querySelector(".grid-cols-2")).toBeInTheDocument();
  });

  it("renders the single-column mobile list below 1024px", async () => {
    vi.mocked(chatService.listRooms).mockResolvedValue(EMPTY);
    mockMatchMedia(false);
    const { container } = renderWithProviders(<ChatRoomListPage />);

    await screen.findByText("المحادثات");
    expect(container.querySelector(".grid-cols-2")).not.toBeInTheDocument();
  });
});
