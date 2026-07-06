import { Languages, CheckCheck } from "lucide-react";
import { formatTime } from "./useChatRoomDetailData";
import type { ChatMessage } from "@/types/chat";

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isSelf: boolean;
  selfBubbleClass: string;
  selfMetaClass: string;
}

/** A single chat bubble — shared between ChatRoomDetailPageDesktop and
 * ChatRoomDetailPageMobile. The current viewer's own messages (`isSelf`)
 * are colored by their own role (`selfBubbleClass`, computed in
 * useChatRoomDetailData from agent/client/admin — T8.6's "فقاعات المستخدم
 * الحالي بلون دوره"); the other party's bubble stays neutral. */
export function ChatMessageBubble({ message, isSelf, selfBubbleClass, selfMetaClass }: ChatMessageBubbleProps) {
  return (
    <div className={`mb-2 flex ${isSelf ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isSelf ? `rounded-br-md ${selfBubbleClass}` : "rounded-bl-md border border-slate-200 bg-white text-slate-900"
        }`}
      >
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
        <div className={`mt-1 flex items-center justify-end gap-1.5 ${isSelf ? selfMetaClass : "text-slate-400"}`}>
          {message.is_translated && (
            <span title={`مترجم من ${message.source_lang}`}>
              <Languages className="h-3 w-3" />
            </span>
          )}
          <span className="text-[10px]">{formatTime(message.created_at)}</span>
          {isSelf && (
            <span title={message.read_at ? "مقروءة" : "تم الإرسال"}>
              <CheckCheck className={`h-3.5 w-3.5 ${message.read_at ? "text-sky-300" : selfMetaClass}`} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
