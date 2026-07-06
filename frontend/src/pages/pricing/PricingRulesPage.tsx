import { useMediaQuery } from "@/hooks/useMediaQuery";
import { PricingRulesPageDesktop } from "./PricingRulesPageDesktop";
import { PricingRulesPageMobile } from "./PricingRulesPageMobile";

// Thin breakpoint switcher — CLAUDE.md forbids a single responsive file
// that hides/shows layout via hidden/lg:block; the real desktop and mobile
// layouts live in their own files (PricingRulesPageDesktop / PricingRulesPageMobile).
export function PricingRulesPage() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? <PricingRulesPageDesktop /> : <PricingRulesPageMobile />;
}
