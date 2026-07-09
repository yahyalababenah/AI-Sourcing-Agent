import { useMediaQuery } from "@/hooks/useMediaQuery";
import { WelcomeCarouselDesktop } from "./WelcomeCarouselDesktop";
import { WelcomeCarouselMobile } from "./WelcomeCarouselMobile";
import type { WelcomeSlide } from "@/constants/onboardingSteps";
import type { OnboardingRole } from "./roleAccent";

interface WelcomeCarouselProps {
  role: OnboardingRole;
  slides: WelcomeSlide[];
  onStartTour: () => void;
  onSnooze: () => void;
  onSkipForever: () => void;
}

// Thin breakpoint switcher — CLAUDE.md forbids a single responsive file
// that hides/shows layout via hidden/lg:block; the real desktop and mobile
// layouts live in their own files.
export function WelcomeCarousel(props: WelcomeCarouselProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  return isDesktop ? <WelcomeCarouselDesktop {...props} /> : <WelcomeCarouselMobile {...props} />;
}
