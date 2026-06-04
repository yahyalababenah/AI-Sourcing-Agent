import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  User,
  Languages,
  CheckCheck,
  Loader2,
} from "lucide-react";
import { chatService } from "@/services/chatService";
import { useAuthStore } from "@/stores/authStore";
import { getAccessToken } from "@/lib/auth";
import type { ChatMessage, ChatRoom } from "@/types/chat";

// ── Helpers ────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "اليوم";
  if (d.toDateString() === yesterday.toDateString()) return "أمس";
  return d.toLocaleDateString("ar-SA", { day: "numeric", month: "short" });
}

function groupByDate(messages: ChatMessage[]): { date: string; items: ChatMessage[] }[] {
  const groups: Record<string, ChatMessage[]> = {};
  for (const msg of messages) {
    const dateKey = new Date(msg.created_at).toDateString();
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(msg);
  }
  return Object.entries(groups).map(([, items]) => ({
    date: formatDate(items[0].created_at),
    items,
  }));
}

// ── SSE hook ───────────────────────────────────────────────────────

function useRoomSSE(
  roomId: string | undefined,
  onMessage: (msg: ChatMessage) => void,
) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!roomId) return;
    const token = getAccessToken();
    if (!token) return;

    const abortController = new AbortController();
    let reconnectTimer: ReturnType<typeof setTimeout>;

    async function connect() {
      try {
        const response = await fetch(`/api/v1/chat/rooms/${roomId}/stream`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: abortController.signal,
        });

        if (!response.ok) {
          // Non-retryable — just log
          console.warn("SSE connection failed:", response.status);
          return;
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              if (eventType === "new_message") {
                try {
                  const data = JSON.parse(line.slice(6));
                  onMessageRef.current(data as ChatMessage);
                } catch {
                  // ignore malformed JSON
                }
              }
              eventType = "";
            }
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        // Reconnect after delay on connection drop
        reconnectTimer = setTimeout(connect, 3000);
      }
    }

    connect();

    return () => {
      abortController.abort();
      clearTimeout(reconnectTimer);
    };
  }, [roomId]);
}

// ── Component ──────────────────────────────────────────────────────

export function ChatRoomDetailPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const currentUserId = currentUser?.id ?? "";

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch room info
  useEffect(() => {
    if (!roomId) return;
    chatService
      .getRoom(roomId)
      .then(setRoom)
      .catch(() => navigate("/chat"));
  }, [roomId, navigate]);

  // Fetch messages
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    chatService
      .getMessages(roomId)
      .then((res) => {
        if (!cancelled) {
          setMessages(res.items);
        }
      })
      .catch((err: any) => {
        if (!cancelled)
          setError(err?.response?.data?.detail || "فشل تحميل الرسائل");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // SSE for real-time updates
  const handleNewMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      // Deduplicate
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
    // Also update room last_message if on same page
    setRoom((prev) => {
      if (!prev) return prev;
      return { ...prev, last_message: msg.content, last_message_at: msg.created_at };
    });
  }, []);

  useRoomSSE(roomId, handleNewMessage);

  // Send message
  const handleSend = async () => {
    const content = inputText.trim();
    if (!content || !roomId || sending) return;

    setSending(true);
    try {
      const msg = await chatService.sendMessage(roomId, { content });
      setMessages((prev) => [...prev, msg]);
      setInputText("");
      // Update room last_message
      setRoom((prev) => {
        if (!prev) return prev;
        return { ...prev, last_message: content, last_message_at: msg.created_at };
      });
    } catch {
      // Error handled silently — message will appear via SSE if it was sent
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const otherName =
    room && currentUserId
      ? room.client_id === currentUserId
        ? room.supplier_name
        : room.client_name
      : "";

  // ── Render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mx-auto flex max-w-3xl items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => navigate("/chat")}
            className="mt-3 rounded-lg bg-gray-600 px-4 py-2 text-sm text-white transition hover:bg-gray-700"
          >
            العودة للمحادثات
          </button>
        </div>
      </div>
    );
  }

  const grouped = groupByDate(messages);

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col p-4">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 pb-3">
        <button
          onClick={() => navigate("/chat")}
          className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
        >
          <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-700">
          <User className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{otherName}</h2>
          {room?.rfq_id && (
            <p className="text-xs text-gray-400">
              RFQ: {room.rfq_id.slice(0, 8)}...
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-gray-400">
              <User className="mx-auto mb-2 h-10 w-10" />
              <p>ابدأ المحادثة مع {otherName}</p>
              <p className="mt-1 text-sm">أرسل رسالة أدناه</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map((group) => (
              <div key={group.date}>
                <div className="mb-3 text-center">
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
                    {group.date}
                  </span>
                </div>
                {group.items.map((msg) => {
                  const isSelf = msg.sender_id === currentUserId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isSelf ? "justify-end" : "justify-start"} mb-2`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                          isSelf
                            ? "rounded-br-md bg-primary-600 text-white"
                            : "rounded-bl-md border border-gray-200 bg-white text-gray-900"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                          {msg.content}
                        </p>
                        <div
                          className={`mt-1 flex items-center justify-end gap-1.5 ${
                            isSelf ? "text-primary-200" : "text-gray-400"
                          }`}
                        >
                          {/* Translation indicator */}
                          {msg.is_translated && (
                            <span title={`مترجم من ${msg.source_lang}`}>
                              <Languages className="h-3 w-3" />
                            </span>
                          )}
                          {/* Time */}
                          <span className="text-[10px]">
                            {formatTime(msg.created_at)}
                          </span>
                          {/* Read receipt */}
                          {isSelf && (
                            <span title={msg.read_at ? "مقروءة" : "تم الإرسال"}>
                              <CheckCheck
                                className={`h-3.5 w-3.5 ${
                                  msg.read_at
                                    ? "text-blue-300"
                                    : "text-primary-300"
                                }`}
                              />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 pt-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب رسالتك هنا..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            style={{ minHeight: 44, maxHeight: 120 }}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || sending}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
