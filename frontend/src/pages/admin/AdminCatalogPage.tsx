import { useMediaQuery } from "@/hooks/useMediaQuery";
import { AdminCatalogPageDesktop } from "./AdminCatalogPageDesktop";
import { AdminCatalogPageMobile } from "./AdminCatalogPageMobile";

// Thin breakpoint switcher — CLAUDE.md forbids a single responsive file
// that hides/shows layout via hidden/lg:block; the real desktop and mobile
// layouts live in their own files (AdminCatalogPageDesktop / Mobile).
export function AdminCatalogPage() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? <AdminCatalogPageDesktop /> : <AdminCatalogPageMobile />;
}
