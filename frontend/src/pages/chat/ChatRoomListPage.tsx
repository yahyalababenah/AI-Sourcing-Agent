import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ChatRoomListPageDesktop } from "./ChatRoomListPageDesktop";
import { ChatRoomListPageMobile } from "./ChatRoomListPageMobile";

// Thin breakpoint switcher (T8.6) — real layouts live in
// ChatRoomListPageDesktop/Mobile, sharing useChatRoomListData.ts.
export function ChatRoomListPage() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? <ChatRoomListPageDesktop /> : <ChatRoomListPageMobile />;
}
