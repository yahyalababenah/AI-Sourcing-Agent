import { ArrowLeft, Send, User, Loader2, FileText } from "lucide-react";
import { useChatRoomDetailData, groupByDate } from "./useChatRoomDetailData";
import { ChatMessageBubble } from "./ChatMessageBubble";

// Same shared hook/logic as ChatRoomDetailPageMobile, in a wider column
// (max-w-4xl vs max-w-3xl) with a larger conversation header — no
// chat-*.html reference exists for Phase 8, so the desktop/mobile
// difference here is spacing/width rather than a structural relayout
// (matches the reels/pricing pages' precedent when no visual reference
// dictates a bigger structural change).
export function ChatRoomDetailPageDesktop() {
  const {
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
  } = useChatRoomDetailData();

  if (loading) {
    return (
      <div className="mx-auto flex max-w-4xl items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-red-600">{error}</p>
          <div className="mt-4 flex justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white transition-colors duration-150 hover:bg-brand-600 active:scale-[0.98]"
            >
              إعادة المحاولة
            </button>
            <button
              onClick={() => navigate("/chat")}
              className="rounded-lg bg-slate-600 px-4 py-2 text-sm text-white transition-colors duration-150 hover:bg-slate-700 active:scale-[0.98]"
            >
              العودة للمحادثات
            </button>
          </div>
        </div>
      </div>
    );
  }

  const grouped = groupByDate(messages);

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-4xl flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <button
          onClick={() => navigate("/chat")}
          className="rounded-lg p-2 text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 active:scale-[0.98]"
        >
          <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
        </button>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <User className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold text-slate-900">{otherName}</h2>
          {room?.rfq_id && <p className="text-xs text-slate-400">RFQ: {room.rfq_id.slice(0, 8)}...</p>}
        </div>
        {canSendQuote && (
          <button
            onClick={handleSendQuote}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-supplier-500 px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-supplier-600 active:scale-[0.98]"
          >
            <FileText className="h-4 w-4" />
            أرسل عرض سعر
          </button>
        )}
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-slate-400">
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
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">{group.date}</span>
                </div>
                {group.items.map((msg) => (
                  <ChatMessageBubble
                    key={msg.id}
                    message={msg}
                    isSelf={msg.sender_id === currentUserId}
                    selfBubbleClass={selfBubbleClass}
                    selfMetaClass={selfMetaClass}
                  />
                ))}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب رسالتك هنا..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors duration-150 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            style={{ minHeight: 44, maxHeight: 120 }}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || sending}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white transition-colors duration-150 hover:bg-brand-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
