import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ClientDashboardDesktop } from "./ClientDashboardDesktop";
import { ClientDashboardMobile } from "./ClientDashboardMobile";

// Thin breakpoint switcher — CLAUDE.md forbids a single responsive file
// that hides/shows layout via hidden/lg:block; the real desktop and mobile
// layouts live in their own files (ClientDashboardDesktop / ClientDashboardMobile).
export function ClientDashboard() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? <ClientDashboardDesktop /> : <ClientDashboardMobile />;
}
