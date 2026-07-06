import { useMediaQuery } from "@/hooks/useMediaQuery";
import { AdminHSCodeSchedulesPageDesktop } from "./AdminHSCodeSchedulesPageDesktop";
import { AdminHSCodeSchedulesPageMobile } from "./AdminHSCodeSchedulesPageMobile";

// Thin breakpoint switcher — CLAUDE.md forbids a single responsive file
// that hides/shows layout via hidden/lg:block; the real desktop and mobile
// layouts live in their own files (AdminHSCodeSchedulesPageDesktop / Mobile).
export function AdminHSCodeSchedulesPage() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? <AdminHSCodeSchedulesPageDesktop /> : <AdminHSCodeSchedulesPageMobile />;
}
