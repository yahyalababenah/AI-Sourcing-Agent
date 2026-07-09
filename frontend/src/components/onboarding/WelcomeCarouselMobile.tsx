import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import type { WelcomeSlide } from "@/constants/onboardingSteps";
import { useCarouselNav } from "@/hooks/useCarouselNav";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { roleAccent, type OnboardingRole } from "./roleAccent";
import { welcomeSlideIcons } from "./welcomeSlideIcons";

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
  const SlideIcon = welcomeSlideIcons[slide.id];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-white lg:hidden" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-carousel-title-mobile"
        className="relative flex h-full flex-col p-6"
      >
        {/* Decorative glow blobs — purely visual, gives the screen depth/life */}
        <div aria-hidden className={`pointer-events-none absolute -top-10 -end-16 h-56 w-56 rounded-full opacity-20 blur-3xl ${accent.glow}`} />
        <div aria-hidden className={`pointer-events-none absolute -bottom-16 -start-10 h-48 w-48 rounded-full opacity-10 blur-3xl ${accent.glow}`} />

        <div className="relative mb-8 flex items-center justify-between text-[13px]">
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

        <div
          key={slide.id}
          className="relative flex flex-1 flex-col items-center justify-center text-center motion-safe:animate-[onboardPopIn_400ms_cubic-bezier(0.34,1.56,0.64,1)]"
        >
          {SlideIcon && (
            <div
              className={`mb-6 flex h-24 w-24 items-center justify-center rounded-3xl shadow-lg motion-safe:animate-[onboardIconBounce_500ms_ease-out] ${accent.iconBadge}`}
            >
              <SlideIcon className="h-12 w-12 text-white" strokeWidth={1.75} />
            </div>
          )}
          <h2 id="welcome-carousel-title-mobile" className="mb-3 text-xl font-extrabold leading-tight text-slate-900">
            {t(slide.titleKey)}
          </h2>
          <p className="text-base leading-relaxed text-slate-600">{t(slide.descriptionKey)}</p>
        </div>

        <div className="relative mb-6 flex items-center justify-center gap-2">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              aria-label={`${i + 1}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === index ? `w-8 ${accent.dot}` : `w-2 ${accent.dotInactive}`
              }`}
            />
          ))}
        </div>

        <button
          onClick={isLast ? onStartTour : next}
          className={`relative flex w-full items-center justify-center gap-1.5 rounded-xl py-4 text-sm font-bold shadow-md transition-all duration-150 active:scale-[0.97] ${accent.button}`}
        >
          {isLast ? t("onboarding.controls.startTour") : t("onboarding.controls.next")}
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </button>
      </div>
    </div>
  );
}
