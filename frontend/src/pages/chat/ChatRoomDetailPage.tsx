import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ChatRoomDetailPageDesktop } from "./ChatRoomDetailPageDesktop";
import { ChatRoomDetailPageMobile } from "./ChatRoomDetailPageMobile";

// Thin breakpoint switcher (T8.6) — CLAUDE.md forbids a single responsive
// file; the real desktop and mobile layouts live in their own files,
// sharing all data/logic via useChatRoomDetailData.ts and the
// ChatMessageBubble component. Shared across all authenticated roles (no
// RoleGuard on this route) — only the device switch, no role branching.
export function ChatRoomDetailPage() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? <ChatRoomDetailPageDesktop /> : <ChatRoomDetailPageMobile />;
}
