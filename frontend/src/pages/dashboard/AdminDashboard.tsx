import { useMediaQuery } from "@/hooks/useMediaQuery";
import { AdminDashboardDesktop } from "./AdminDashboardDesktop";
import { AdminDashboardMobile } from "./AdminDashboardMobile";

// Thin breakpoint switcher — CLAUDE.md forbids a single responsive file
// that hides/shows layout via hidden/lg:block; the real desktop and mobile
// layouts live in their own files (AdminDashboardDesktop / AdminDashboardMobile).
export function AdminDashboard() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? <AdminDashboardDesktop /> : <AdminDashboardMobile />;
}
