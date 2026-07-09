import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronLeft } from "lucide-react";
import type { WelcomeSlide } from "@/constants/onboardingSteps";
import { useCarouselNav } from "@/hooks/useCarouselNav";
import { useCarouselKeyboard } from "@/hooks/useCarouselKeyboard";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { roleAccent, type OnboardingRole } from "./roleAccent";

interface WelcomeCarouselDesktopProps {
  role: OnboardingRole;
  slides: WelcomeSlide[];
  onStartTour: () => void;
  onSnooze: () => void;
  onSkipForever: () => void;
}

export function WelcomeCarouselDesktop({
  role,
  slides,
  onStartTour,
  onSnooze,
  onSkipForever,
}: WelcomeCarouselDesktopProps) {
  const { t } = useTranslation();
  const { index, isFirst, isLast, next, back, goTo } = useCarouselNav(slides.length);
  const accent = roleAccent[role];
  const dialogRef = useFocusTrap<HTMLDivElement>(true);

  useCarouselKeyboard({
    onNext: () => (isLast ? onStartTour() : next()),
    onBack: back,
    onEscape: onSnooze,
  });

  const slide = slides[index];

  return (
    <div
      className="fixed inset-0 z-[60] hidden items-center justify-center bg-slate-900/50 p-6 lg:flex"
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-carousel-title"
        className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-xl transition-all duration-200 motion-reduce:transition-none"
      >
        <div className="mb-6 flex items-center justify-between text-[13px]">
          <button
            onClick={onSnooze}
            className="text-slate-400 transition-colors duration-150 hover:text-slate-600"
          >
            {t("onboarding.controls.snooze")}
          </button>
          <button
            onClick={onSkipForever}
            className="text-slate-400 transition-colors duration-150 hover:text-slate-600"
          >
            {t("onboarding.controls.skipForever")}
          </button>
        </div>

        <h2 id="welcome-carousel-title" className="mb-3 text-xl font-bold text-slate-900">
          {t(slide.titleKey)}
        </h2>
        <p className="mb-8 text-sm leading-relaxed text-slate-600">{t(slide.descriptionKey)}</p>

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

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={back}
            disabled={isFirst}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-all duration-150 hover:bg-slate-50 disabled:opacity-0"
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            {t("onboarding.controls.back")}
          </button>
          <button
            onClick={isLast ? onStartTour : next}
            className={`flex items-center gap-1 rounded-lg px-5 py-2.5 text-sm font-bold transition-all duration-150 active:scale-[0.98] ${accent.button}`}
          >
            {isLast ? t("onboarding.controls.startTour") : t("onboarding.controls.next")}
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
}
