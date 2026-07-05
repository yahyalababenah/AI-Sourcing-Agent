import { useMediaQuery } from "@/hooks/useMediaQuery";
import { PricingCalcPageDesktop } from "./PricingCalcPageDesktop";
import { PricingCalcPageMobile } from "./PricingCalcPageMobile";

// Thin breakpoint switcher — CLAUDE.md forbids a single responsive file
// that hides/shows layout via hidden/lg:block; the real desktop and mobile
// layouts live in their own files (PricingCalcPageDesktop / PricingCalcPageMobile).
export function PricingCalcPage() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? <PricingCalcPageDesktop /> : <PricingCalcPageMobile />;
}
