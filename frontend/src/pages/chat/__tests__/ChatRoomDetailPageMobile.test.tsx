import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChatRoomDetailPageMobile } from "../ChatRoomDetailPageMobile";
import { chatService } from "@/services/chatService";
import { useAuthStore } from "@/stores/authStore";
import type { ChatMessage, ChatRoom } from "@/types/chat";

vi.mock("@/services/chatService");

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    room_id: "room-1",
    sender_id: "user-supplier",
    sender_name: "Guangzhou Factory",
    content: "hello",
    original_content: null,
    source_lang: "zh",
    target_lang: null,
    is_translated: false,
    created_at: new Date().toISOString(),
    read_at: null,
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/chat/room-1"]}>
        <Routes>
          <Route path="/chat/:roomId" element={<ChatRoomDetailPageMobile />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ChatRoomDetailPageMobile", () => {
  beforeEach(() => {
    localStorage.setItem("access_token", "fake-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new ReadableStream(), { status: 200 })));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("colors the current agent's own bubble supplier-green", async () => {
    useAuthStore.setState({
      user: { id: "user-supplier", email: "s@example.com", full_name: "Factory", role: "agent", phone: null, is_active: true, created_at: "" } as any,
      role: "agent",
    });
    const room: ChatRoom = {
      id: "room-1", rfq_id: null, client_id: "user-client", supplier_id: "user-supplier",
      status: "active", client_name: "Ali", supplier_name: "Factory",
      last_message: null, last_message_at: null, unread_count: 0, created_at: "2026-01-01T00:00:00Z",
    };
    vi.mocked(chatService.getRoom).mockResolvedValue(room);
    vi.mocked(chatService.getMessages).mockResolvedValue({
      items: [makeMessage({ sender_id: "user-supplier", content: "أهلاً من المصنع" })],
      total: 1, page: 1, page_size: 50,
    });

    renderPage();

    const bubbleText = await screen.findByText("أهلاً من المصنع");
    expect(bubbleText.closest("div")).toHaveClass("bg-supplier-600");
  });

  it("shows the 'أرسل عرض سعر' button for an agent when the room is linked to an RFQ", async () => {
    useAuthStore.setState({
      user: { id: "user-supplier", email: "s@example.com", full_name: "Factory", role: "agent", phone: null, is_active: true, created_at: "" } as any,
      role: "agent",
    });
    const room: ChatRoom = {
      id: "room-1", rfq_id: "rfq-123", client_id: "user-client", supplier_id: "user-supplier",
      status: "active", client_name: "Ali", supplier_name: "Factory",
      last_message: null, last_message_at: null, unread_count: 0, created_at: "2026-01-01T00:00:00Z",
    };
    vi.mocked(chatService.getRoom).mockResolvedValue(room);
    vi.mocked(chatService.getMessages).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });

    renderPage();

    expect(await screen.findByRole("button", { name: /أرسل عرض سعر/ })).toBeInTheDocument();
  });

  it("hides the 'أرسل عرض سعر' button for a client even when the room is RFQ-linked", async () => {
    useAuthStore.setState({
      user: { id: "user-client", email: "c@example.com", full_name: "Ali", role: "client", phone: null, is_active: true, created_at: "" } as any,
      role: "client",
    });
    const room: ChatRoom = {
      id: "room-1", rfq_id: "rfq-123", client_id: "user-client", supplier_id: "user-supplier",
      status: "active", client_name: "Ali", supplier_name: "Factory",
      last_message: null, last_message_at: null, unread_count: 0, created_at: "2026-01-01T00:00:00Z",
    };
    vi.mocked(chatService.getRoom).mockResolvedValue(room);
    vi.mocked(chatService.getMessages).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });

    renderPage();

    await screen.findByText("Factory");
    expect(screen.queryByRole("button", { name: /أرسل عرض سعر/ })).not.toBeInTheDocument();
  });
});
