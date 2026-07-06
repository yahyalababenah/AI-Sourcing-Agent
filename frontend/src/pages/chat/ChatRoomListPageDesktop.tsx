import { useNavigate } from "react-router-dom";
import { MessageCircle, ChevronLeft, User } from "lucide-react";
import { useChatRoomListData, formatTime, getOtherPartyName } from "./useChatRoomListData";

// Room list, desktop (T8.6). Same shared hook/logic as
// ChatRoomListPageMobile — wider container with a two-column card grid
// instead of a single stacked list (no chat-*.html reference exists for
// Phase 8, so the desktop/mobile difference here is layout density rather
// than a dictated relayout).
export function ChatRoomListPageDesktop() {
  const navigate = useNavigate();
  const { rooms, loading, error, currentUserId } = useChatRoomListData();

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">المحادثات</h1>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 h-5 w-1/3 rounded bg-slate-200" />
              <div className="h-4 w-2/3 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">المحادثات</h1>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm text-white transition-colors duration-150 hover:bg-red-700 active:scale-[0.98]"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">المحادثات</h1>

      {rooms.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <MessageCircle className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="text-slate-500">لا توجد محادثات بعد</p>
          <p className="mt-1 text-sm text-slate-400">ابدأ محادثة مع مورد من صفحة المنتجات</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {rooms.map((room) => {
            const otherName = getOtherPartyName(room, currentUserId);

            return (
              <button
                key={room.id}
                onClick={() => navigate(`/chat/${room.id}`)}
                className="w-full rounded-xl border border-slate-200 bg-white p-4 text-start shadow-sm transition-all duration-150 hover:border-brand-300 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    <User className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">{otherName}</span>
                      <span className="shrink-0 text-xs text-slate-400">{formatTime(room.last_message_at)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate text-sm text-slate-500">{room.last_message || "بدون رسائل"}</p>
                      {room.unread_count > 0 && (
                        <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-brand-500 px-1.5 text-xs font-bold text-white">
                          {room.unread_count > 99 ? "99+" : room.unread_count}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronLeft className="h-5 w-5 shrink-0 text-slate-300 rtl:rotate-180" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
