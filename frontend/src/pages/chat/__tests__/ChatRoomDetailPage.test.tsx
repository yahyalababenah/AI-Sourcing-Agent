import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChatRoomDetailPage } from "../ChatRoomDetailPage";
import { chatService } from "@/services/chatService";
import { useAuthStore } from "@/stores/authStore";
import type { ChatMessage, ChatRoom } from "@/types/chat";

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

/** A fetch() Response backed by a stream the test can push SSE chunks into
 * on demand, matching how ChatRoomDetailPage's inline useRoomSSE hook reads
 * the /stream endpoint (fetch + ReadableStream, not EventSource). */
function createControllableSSEResponse() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  const encoder = new TextEncoder();
  return {
    response: new Response(stream, { status: 200 }),
    pushEvent(type: string, data: unknown) {
      controller.enqueue(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`));
    },
    close() {
      controller.close();
    },
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/chat/rooms/room-1"]}>
        <Routes>
          <Route path="/chat/rooms/:roomId" element={<ChatRoomDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ChatRoomDetailPage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.setItem("access_token", "fake-token");
    useAuthStore.setState({
      user: { id: "user-client", email: "c@example.com", full_name: "Ali", role: "client", phone: null, is_active: true, created_at: "" } as any,
    });
    vi.mocked(chatService.getRoom).mockResolvedValue(ROOM);
    vi.mocked(chatService.getMessages).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });

    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("loads room details and existing messages", async () => {
    vi.mocked(chatService.getMessages).mockResolvedValue({
      items: [makeMessage({ content: "أهلاً" })],
      total: 1, page: 1, page_size: 50,
    });
    const { response } = createControllableSSEResponse();
    fetchMock.mockResolvedValue(response);

    renderPage();

    expect(await screen.findByText("Guangzhou Factory")).toBeInTheDocument();
    expect(await screen.findByText("أهلاً")).toBeInTheDocument();
  });

  it("receives a new message pushed over the SSE stream in real time", async () => {
    const sse = createControllableSSEResponse();
    fetchMock.mockResolvedValue(sse.response);

    renderPage();
    await screen.findByText("Guangzhou Factory");

    sse.pushEvent("new_message", makeMessage({ content: "وصل عرض السعر" }));

    expect(await screen.findByText("وصل عرض السعر")).toBeInTheDocument();
  });

  it("deduplicates a message that arrives both via SSE and the initial fetch", async () => {
    const duplicate = makeMessage({ id: "dup-1", content: "رسالة مكررة" });
    vi.mocked(chatService.getMessages).mockResolvedValue({
      items: [duplicate], total: 1, page: 1, page_size: 50,
    });
    const sse = createControllableSSEResponse();
    fetchMock.mockResolvedValue(sse.response);

    renderPage();
    await screen.findByText("رسالة مكررة");

    sse.pushEvent("new_message", duplicate); // same id again

    await waitFor(() => {
      expect(screen.getAllByText("رسالة مكررة")).toHaveLength(1);
    });
  });

  it("sends a message via the API and appends it optimistically", async () => {
    const sse = createControllableSSEResponse();
    fetchMock.mockResolvedValue(sse.response);
    vi.mocked(chatService.sendMessage).mockResolvedValue(
      makeMessage({ sender_id: "user-client", content: "أحتاج عرض سعر" }),
    );

    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Guangzhou Factory");

    await user.type(screen.getByPlaceholderText("اكتب رسالتك هنا..."), "أحتاج عرض سعر");
    // The send button has no accessible name (icon-only, no aria-label) —
    // it's the last button in the DOM (header back-button is first).
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(chatService.sendMessage).toHaveBeenCalledWith("room-1", { content: "أحتاج عرض سعر" });
    });
    expect(await screen.findByText("أحتاج عرض سعر")).toBeInTheDocument();
  });

  it("shows an error state when the room fails to load", async () => {
    vi.mocked(chatService.getRoom).mockRejectedValue({
      response: { data: { detail: "لم يتم العثور على المحادثة" } },
    });
    const sse = createControllableSSEResponse();
    fetchMock.mockResolvedValue(sse.response);

    renderPage();

    expect(await screen.findByText("لم يتم العثور على المحادثة")).toBeInTheDocument();
  });

  it("reconnects the SSE stream after a connection drop (fetch rejects)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const sse = createControllableSSEResponse();
    fetchMock.mockRejectedValueOnce(new Error("network drop")).mockResolvedValue(sse.response);

    renderPage();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(3100); // hook's hardcoded 3s reconnect delay

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    vi.useRealTimers();
  });
});
