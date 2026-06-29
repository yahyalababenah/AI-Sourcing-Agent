import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, ChevronLeft, User } from "lucide-react";
import { chatService } from "@/services/chatService";
import { useAuthStore } from "@/stores/authStore";
import type { ChatRoom } from "@/types/chat";

function formatTime(iso: string | null): string {
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

function getOtherPartyName(room: ChatRoom, currentUserId: string): string {
  return room.client_id === currentUserId
    ? room.supplier_name
    : room.client_name;
}

export function ChatRoomListPage() {
  const navigate = useNavigate();
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
        if (!cancelled)
          setError(err?.response?.data?.detail || "فشل تحميل المحادثات");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentUserId = currentUser?.id ?? "";

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">
          المحادثات
        </h1>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="mb-2 h-5 w-1/3 rounded bg-gray-200" />
              <div className="h-4 w-2/3 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">
          المحادثات
        </h1>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm text-white transition hover:bg-red-700"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">المحادثات</h1>

      {rooms.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <MessageCircle className="mx-auto mb-3 h-12 w-12 text-gray-300" />
          <p className="text-gray-500">لا توجد محادثات بعد</p>
          <p className="mt-1 text-sm text-gray-400">
            ابدأ محادثة مع مورد من صفحة المنتجات
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rooms.map((room) => {
            const otherName = getOtherPartyName(room, currentUserId);

            return (
              <button
                key={room.id}
                onClick={() => navigate(`/chat/${room.id}`)}
                className="w-full rounded-xl border border-gray-200 bg-white p-4 text-right shadow-sm transition hover:border-primary-300 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                    <User className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-gray-900">
                        {otherName}
                      </span>
                      <span className="shrink-0 text-xs text-gray-400">
                        {formatTime(room.last_message_at)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate text-sm text-gray-500">
                        {room.last_message || "بدون رسائل"}
                      </p>
                      {room.unread_count > 0 && (
                        <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-primary-600 px-1.5 text-xs font-bold text-white">
                          {room.unread_count > 99
                            ? "99+"
                            : room.unread_count}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronLeft className="h-5 w-5 shrink-0 text-gray-300 rtl:rotate-180" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
