import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ReelsStudioPageDesktop } from "./ReelsStudioPageDesktop";
import { ReelsStudioPageMobile } from "./ReelsStudioPageMobile";

// Thin breakpoint switcher — CLAUDE.md forbids a single responsive file that
// hides/shows layout via hidden/lg:block; the real desktop and mobile layouts
// live in their own files (ReelsStudioPageDesktop / ReelsStudioPageMobile).
export function ReelsStudioPage() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? <ReelsStudioPageDesktop /> : <ReelsStudioPageMobile />;
}
