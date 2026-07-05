import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ClientReelsPageDesktop } from "./ClientReelsPageDesktop";
import { ClientReelsPageMobile } from "./ClientReelsPageMobile";

// Thin breakpoint switcher — same pattern as ReelsStudioPage/LoginPage/etc.
// CLAUDE.md forbids a single responsive file toggling layout via
// hidden/lg:block; the real layouts live in ClientReelsPageDesktop/Mobile.
export function ClientReelsPage() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? <ClientReelsPageDesktop /> : <ClientReelsPageMobile />;
}
