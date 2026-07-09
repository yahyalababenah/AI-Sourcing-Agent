import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useCarouselKeyboard } from "@/hooks/useCarouselKeyboard";
import { roleAccent } from "./roleAccent";
import { computePopoverPosition } from "./computePopoverPosition";
import type { TourStepPanelProps } from "./tourStepTypes";

const POPOVER_WIDTH = 320;
const POPOVER_HEIGHT = 220;

/**
 * Desktop guided-tour step panel. Portaled to document.body and positioned
 * from the target's rect (never from DOM ancestry — see plan §2.7-c). Shows
 * a skeleton while the target is still resolving (§2.7-a async DOM targets).
 *
 * The user is already standing on the real feature page by the time this
 * renders (GuidedTour navigates there first) — this panel just narrates
 * what they're looking at, it doesn't send them anywhere else.
 */
export function TourPopover({
  role,
  rect,
  targetStatus,
  title,
  description,
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

  useCarouselKeyboard({
    onNext: () => (isLast ? onFinish() : onNext()),
    onBack,
    onEscape: onSnooze,
  });

  if (targetStatus === "timeout" || !rect) return null;

  const position = computePopoverPosition(rect, POPOVER_WIDTH, POPOVER_HEIGHT);

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-popover-title"
      className="fixed z-[9999] rounded-2xl bg-white p-5 shadow-xl transition-[top,left] duration-200 motion-reduce:transition-none"
      style={{ top: position.top, left: position.left, width: POPOVER_WIDTH }}
    >
      {targetStatus === "waiting" ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-2/3 rounded" />
          <Skeleton className="h-3 w-full rounded" />
          <p className="text-xs text-slate-400">{t("onboarding.waiting.message")}</p>
        </div>
      ) : (
        <div key={title} className="motion-safe:animate-[onboardPopIn_320ms_cubic-bezier(0.34,1.56,0.64,1)]">
          {progressSlot}

          <div
            className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full motion-safe:animate-[onboardIconBounce_450ms_ease-out] ${accent.dotInactive}`}
          >
            <Sparkles className={`h-5 w-5 ${accent.text}`} />
          </div>

          <h3 id="tour-popover-title" className="mb-1.5 text-base font-bold text-slate-900">
            {title}
          </h3>
          <p className="mb-4 text-sm leading-relaxed text-slate-600">{description}</p>

          <div className="mb-3 flex items-center justify-between text-[13px]">
            <button
              onClick={onSkipStep}
              className="text-slate-400 transition-colors duration-150 hover:text-slate-600"
            >
              {t("onboarding.controls.skipStep")}
            </button>
            <button
              onClick={onSnooze}
              className="text-slate-400 transition-colors duration-150 hover:text-slate-600"
            >
              {t("onboarding.controls.snooze")}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onBack}
              disabled={isFirst}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-all duration-150 hover:bg-slate-50 disabled:opacity-0"
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              {t("onboarding.controls.back")}
            </button>
            <button
              onClick={isLast ? onFinish : onNext}
              className={`flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-bold transition-all duration-150 active:scale-[0.98] ${accent.button}`}
            >
              {isLast ? t("onboarding.controls.finish") : t("onboarding.controls.next")}
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
