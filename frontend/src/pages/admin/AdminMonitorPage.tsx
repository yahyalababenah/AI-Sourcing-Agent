import { useMediaQuery } from "@/hooks/useMediaQuery";
import { AdminMonitorPageDesktop } from "./AdminMonitorPageDesktop";
import { AdminMonitorPageMobile } from "./AdminMonitorPageMobile";

// Thin breakpoint switcher — CLAUDE.md forbids a single responsive file
// that hides/shows layout via hidden/lg:block; the real desktop and mobile
// layouts live in their own files (AdminMonitorPageDesktop / AdminMonitorPageMobile).
export function AdminMonitorPage() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? <AdminMonitorPageDesktop /> : <AdminMonitorPageMobile />;
}
