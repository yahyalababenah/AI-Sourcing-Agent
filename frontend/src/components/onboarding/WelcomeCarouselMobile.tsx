import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import type { WelcomeSlide } from "@/constants/onboardingSteps";
import { useCarouselNav } from "@/hooks/useCarouselNav";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { roleAccent, type OnboardingRole } from "./roleAccent";

interface WelcomeCarouselMobileProps {
  role: OnboardingRole;
  slides: WelcomeSlide[];
  onStartTour: () => void;
  onSnooze: () => void;
  onSkipForever: () => void;
}

export function WelcomeCarouselMobile({
  role,
  slides,
  onStartTour,
  onSnooze,
  onSkipForever,
}: WelcomeCarouselMobileProps) {
  const { t } = useTranslation();
  const { index, isLast, next, goTo } = useCarouselNav(slides.length);
  const accent = roleAccent[role];
  const dialogRef = useFocusTrap<HTMLDivElement>(true);

  const slide = slides[index];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white lg:hidden" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-carousel-title-mobile"
        className="flex h-full flex-col p-6"
      >
        <div className="mb-8 flex items-center justify-between text-[13px]">
          <button
            onClick={onSnooze}
            className="text-slate-400 transition-colors duration-150 active:scale-[0.98]"
          >
            {t("onboarding.controls.snooze")}
          </button>
          <button
            onClick={onSkipForever}
            className="text-slate-400 transition-colors duration-150 active:scale-[0.98]"
          >
            {t("onboarding.controls.skipForever")}
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h2 id="welcome-carousel-title-mobile" className="mb-3 text-lg font-bold text-slate-900">
            {t(slide.titleKey)}
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">{t(slide.descriptionKey)}</p>
        </div>

        <div className="mb-6 flex items-center justify-center gap-1.5">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              aria-label={`${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-150 ${
                i === index ? `w-6 ${accent.dot}` : `w-1.5 ${accent.dotInactive}`
              }`}
            />
          ))}
        </div>

        <button
          onClick={isLast ? onStartTour : next}
          className={`flex w-full items-center justify-center gap-1 rounded-lg py-3.5 text-sm font-bold transition-all duration-150 active:scale-[0.98] ${accent.button}`}
        >
          {isLast ? t("onboarding.controls.startTour") : t("onboarding.controls.next")}
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </button>
      </div>
    </div>
  );
}
