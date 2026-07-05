import { useMediaQuery } from "@/hooks/useMediaQuery";
import { LoginPageDesktop } from "./LoginPageDesktop";
import { LoginPageMobile } from "./LoginPageMobile";

// Thin breakpoint switcher — CLAUDE.md forbids a single responsive file
// that hides/shows layout via hidden/lg:block; the real desktop and mobile
// layouts live in their own files (LoginPageDesktop / LoginPageMobile).
export function LoginPage() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? <LoginPageDesktop /> : <LoginPageMobile />;
}
