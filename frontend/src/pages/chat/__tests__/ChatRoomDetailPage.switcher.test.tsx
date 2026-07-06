import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChatRoomDetailPage } from "../ChatRoomDetailPage";
import { chatService } from "@/services/chatService";
import { useAuthStore } from "@/stores/authStore";
import type { ChatRoom } from "@/types/chat";

vi.mock("@/services/chatService");

const ROOM: ChatRoom = {
  id: "room-1",
  rfq_id: null,
  client_id: "user-client",
  supplier_id: "user-supplier",
  status: "active",
  client_name: "Ali Import Co.",
  supplier_name: "Guangzhou Factory",
  last_message: null,
  last_message_at: null,
  unread_count: 0,
  created_at: "2026-01-01T00:00:00Z",
};

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

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/chat/room-1"]}>
        <Routes>
          <Route path="/chat/:roomId" element={<ChatRoomDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ChatRoomDetailPage switcher", () => {
  beforeEach(() => {
    vi.mocked(chatService.getRoom).mockResolvedValue(ROOM);
    vi.mocked(chatService.getMessages).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
    localStorage.setItem("access_token", "fake-token");
    useAuthStore.setState({
      user: { id: "user-client", email: "c@example.com", full_name: "Ali", role: "client", phone: null, is_active: true, created_at: "" } as any,
      role: "client",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new ReadableStream(), { status: 200 })));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("renders the wider desktop conversation panel at >=1024px", async () => {
    mockMatchMedia(true);
    const { container } = renderPage();

    expect(await screen.findByText("Guangzhou Factory")).toBeInTheDocument();
    expect(container.querySelector(".max-w-4xl")).toBeInTheDocument();
  });

  it("renders the full-screen mobile conversation below 1024px", async () => {
    mockMatchMedia(false);
    const { container } = renderPage();

    expect(await screen.findByText("Guangzhou Factory")).toBeInTheDocument();
    expect(container.querySelector(".max-w-4xl")).not.toBeInTheDocument();
  });
});
