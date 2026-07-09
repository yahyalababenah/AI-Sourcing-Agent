import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronLeft } from "lucide-react";
import type { WelcomeSlide } from "@/constants/onboardingSteps";
import { useCarouselNav } from "@/hooks/useCarouselNav";
import { useCarouselKeyboard } from "@/hooks/useCarouselKeyboard";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { roleAccent, type OnboardingRole } from "./roleAccent";
import { WelcomeIllustration } from "./welcomeIllustrations";

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
        className="onboard-pop relative w-full max-w-lg overflow-hidden rounded-3xl bg-white p-9 shadow-2xl"
      >
        {/* Decorative glow blobs — purely visual, gives the card depth/life */}
        <div aria-hidden className={`pointer-events-none absolute -top-16 -end-16 h-48 w-48 rounded-full opacity-20 blur-3xl ${accent.glow}`} />
        <div aria-hidden className={`pointer-events-none absolute -bottom-20 -start-10 h-40 w-40 rounded-full opacity-10 blur-3xl ${accent.glow}`} />

        <div className="relative mb-7 flex items-center justify-between text-[13px]">
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

        <div key={slide.id} className="onboard-pop relative">
          <WelcomeIllustration slideId={slide.id} role={role} className="mb-6 h-28 w-28" />

          <h2 id="welcome-carousel-title" className="mb-3 text-2xl font-extrabold leading-tight text-slate-900">
            {t(slide.titleKey)}
          </h2>
          <p className="mb-8 text-base leading-relaxed text-slate-600">{t(slide.descriptionKey)}</p>
        </div>

        <div className="relative mb-7 flex items-center justify-center gap-2">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              aria-label={`${i + 1}`}
              className={`h-2 rounded-full transition-all duration-300 ease-out ${
                i === index ? `w-8 ${accent.dot}` : `w-2 ${accent.dotInactive}`
              }`}
            />
          ))}
        </div>

        <div className="relative flex items-center justify-between gap-3">
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
            className={`flex items-center gap-1.5 rounded-xl px-6 py-3 text-sm font-bold shadow-md transition-all duration-150 hover:shadow-lg active:scale-[0.97] ${accent.button}`}
          >
            {isLast ? t("onboarding.controls.startTour") : t("onboarding.controls.next")}
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
}
