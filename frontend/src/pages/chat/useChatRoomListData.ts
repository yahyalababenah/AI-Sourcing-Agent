import { useState, useEffect } from "react";
import { chatService } from "@/services/chatService";
import { useAuthStore } from "@/stores/authStore";
import type { ChatRoom } from "@/types/chat";

export function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "الآن";
  if (diffMin < 60) return `منذ ${diffMin} د`;
  if (diffHrs < 24) return `منذ ${diffHrs} س`;
  if (diffDays < 7) return `منذ ${diffDays} ي`;
  return d.toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "short" });
}

export function getOtherPartyName(room: ChatRoom, currentUserId: string): string {
  return room.client_id === currentUserId ? room.supplier_name : room.client_name;
}

/** Shared data/logic behind the chat room list (T8.6) — consumed by both
 * ChatRoomListPageDesktop and ChatRoomListPageMobile. */
export function useChatRoomListData() {
  const currentUser = useAuthStore((s) => s.user);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    chatService
      .listRooms()
      .then((res) => {
        if (!cancelled) setRooms(res.items);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.response?.data?.detail || "فشل تحميل المحادثات");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    rooms,
    loading,
    error,
    currentUserId: currentUser?.id ?? "",
  };
}
