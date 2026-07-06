import { useMediaQuery } from "@/hooks/useMediaQuery";
import { AdminUsersPageDesktop } from "./AdminUsersPageDesktop";
import { AdminUsersPageMobile } from "./AdminUsersPageMobile";

// Thin breakpoint switcher — CLAUDE.md forbids a single responsive file
// that hides/shows layout via hidden/lg:block; the real desktop and mobile
// layouts live in their own files (AdminUsersPageDesktop / AdminUsersPageMobile).
export function AdminUsersPage() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? <AdminUsersPageDesktop /> : <AdminUsersPageMobile />;
}
