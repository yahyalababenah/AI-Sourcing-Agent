import { useMediaQuery } from "@/hooks/useMediaQuery";
import { StandaloneCalcPageDesktop } from "./StandaloneCalcPageDesktop";
import { StandaloneCalcPageMobile } from "./StandaloneCalcPageMobile";

// Thin breakpoint switcher — same pattern as PricingCalcPage.
export function StandaloneCalcPage() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? <StandaloneCalcPageDesktop /> : <StandaloneCalcPageMobile />;
}
