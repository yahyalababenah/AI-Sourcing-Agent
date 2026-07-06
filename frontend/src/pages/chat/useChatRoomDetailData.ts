import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { chatService } from "@/services/chatService";
import { useAuthStore } from "@/stores/authStore";
import { getAccessToken } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";
import type { ChatMessage, ChatRoom } from "@/types/chat";

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("ar-SA-u-ca-gregory", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "اليوم";
  if (d.toDateString() === yesterday.toDateString()) return "أمس";
  return d.toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "short" });
}

export function groupByDate(messages: ChatMessage[]): { date: string; items: ChatMessage[] }[] {
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

// Bubble color for the CURRENT viewer's own messages, per their own role
// (T8.6: "فقاعات المستخدم الحالي بلون دوره") — not a fixed "self" color.
// Same role→color mapping as StatusPill's ROLE_IN_PROGRESS_CLASSES.
const SELF_BUBBLE_CLASSES: Record<string, string> = {
  agent: "bg-supplier-600 text-white",
  client: "bg-importer-600 text-white",
  admin: "bg-slate-700 text-white",
};

const SELF_META_CLASSES: Record<string, string> = {
  agent: "text-supplier-200",
  client: "text-importer-200",
  admin: "text-slate-300",
};

function useRoomSSE(roomId: string | undefined, onMessage: (msg: ChatMessage) => void) {
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

/** Shared data/logic behind the chat conversation window (T8.6) — room +
 * message fetch, SSE live updates, sending, and the RFQ→quote-builder
 * handoff — consumed by both ChatRoomDetailPageDesktop and
 * ChatRoomDetailPageMobile so neither duplicates this logic (same
 * convention as usePricingCalculator/useSupplierRfqInboxData). */
export function useChatRoomDetailData() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const currentUserId = currentUser?.id ?? "";

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!roomId) return;
    chatService
      .getRoom(roomId)
      .then(setRoom)
      .catch((err: any) => {
        setError(err?.response?.data?.detail || "لم يتم العثور على المحادثة");
        setLoading(false);
      });
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    chatService
      .getMessages(roomId)
      .then((res) => {
        if (!cancelled) setMessages(res.items);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.response?.data?.detail || "فشل تحميل الرسائل");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleNewMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
    setRoom((prev) => {
      if (!prev) return prev;
      return { ...prev, last_message: msg.content, last_message_at: msg.created_at };
    });
  }, []);

  useRoomSSE(roomId, handleNewMessage);

  const handleSend = async () => {
    const content = inputText.trim();
    if (!content || !roomId || sending) return;

    setSending(true);
    try {
      const msg = await chatService.sendMessage(roomId, { content });
      setMessages((prev) => [...prev, msg]);
      setInputText("");
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
    room && currentUserId ? (room.client_id === currentUserId ? room.supplier_name : room.client_name) : "";

  // "أرسل عرض سعر" (T8.6): every conversation tied to an RFQ should lead
  // toward a deal — only agents/admins can actually build a quote
  // (ROUTES.RFQ.BUILD_QUOTE is agent/admin-gated), so the button is only
  // offered to them, and only once the room actually carries a real
  // rfq_id (no fabricated link when one doesn't exist).
  const canSendQuote = room?.rfq_id != null && (role === "agent" || role === "admin");
  const handleSendQuote = () => {
    if (room?.rfq_id) navigate(ROUTES.RFQ.BUILD_QUOTE(room.rfq_id));
  };

  const selfBubbleClass = SELF_BUBBLE_CLASSES[role ?? "client"] ?? SELF_BUBBLE_CLASSES.client;
  const selfMetaClass = SELF_META_CLASSES[role ?? "client"] ?? SELF_META_CLASSES.client;

  return {
    roomId,
    room,
    messages,
    loading,
    sending,
    inputText,
    setInputText,
    error,
    messagesEndRef,
    inputRef,
    handleSend,
    handleKeyDown,
    otherName,
    currentUserId,
    canSendQuote,
    handleSendQuote,
    selfBubbleClass,
    selfMetaClass,
    navigate,
  };
}
