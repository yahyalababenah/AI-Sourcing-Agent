import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { roleAccent } from "./roleAccent";
import type { TourStepPanelProps } from "./tourStepTypes";

/**
 * Mobile guided-tour step panel — a bottom sheet instead of a positioned
 * popover (there's rarely room to anchor a floating card near small-screen
 * targets). Portaled to document.body like TourPopover; ignores `rect` for
 * its own placement (it always docks to the bottom) but the Spotlight
 * component still highlights the target above it.
 */
export function TourBottomSheet({
  role,
  targetStatus,
  title,
  description,
  ctaLabel,
  onCta,
  onNext,
  onBack,
  onSkipStep,
  onSnooze,
  onFinish,
  isFirst,
  isLast,
  progressSlot,
}: TourStepPanelProps) {
  const { t } = useTranslation();
  const accent = roleAccent[role];
  const dialogRef = useFocusTrap<HTMLDivElement>(targetStatus === "found");

  if (targetStatus === "timeout") return null;

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-sheet-title"
      className="fixed inset-x-0 bottom-0 z-[9999] rounded-t-2xl bg-white p-5 pb-6 shadow-xl transition-all duration-200 lg:hidden"
    >
      {targetStatus === "waiting" ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-2/3 rounded" />
          <Skeleton className="h-3 w-full rounded" />
          <p className="text-xs text-slate-400">{t("onboarding.waiting.message")}</p>
        </div>
      ) : (
        <>
          {progressSlot}

          <h3 id="tour-sheet-title" className="mb-1.5 text-base font-bold text-slate-900">
            {title}
          </h3>
          <p className="mb-4 text-sm leading-relaxed text-slate-600">{description}</p>

          {ctaLabel && onCta && (
            <button
              onClick={onCta}
              className={`mb-3 w-full rounded-lg px-4 py-3 text-sm font-bold transition-all duration-150 active:scale-[0.98] ${accent.button}`}
            >
              {ctaLabel}
            </button>
          )}

          <div className="mb-3 flex items-center justify-between text-[13px]">
            <button
              onClick={onSkipStep}
              className="text-slate-400 transition-colors duration-150 active:scale-[0.98]"
            >
              {t("onboarding.controls.skipStep")}
            </button>
            <button
              onClick={onSnooze}
              className="text-slate-400 transition-colors duration-150 active:scale-[0.98]"
            >
              {t("onboarding.controls.snooze")}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onBack}
              disabled={isFirst}
              className="flex items-center gap-1 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition-all duration-150 active:scale-[0.98] disabled:opacity-0"
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              {t("onboarding.controls.back")}
            </button>
            <button
              onClick={isLast ? onFinish : onNext}
              className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-4 py-2.5 text-sm font-bold transition-all duration-150 active:scale-[0.98] ${accent.button}`}
            >
              {isLast ? t("onboarding.controls.finish") : t("onboarding.controls.next")}
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </button>
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
