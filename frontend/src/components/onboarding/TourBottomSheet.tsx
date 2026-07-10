import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { roleAccent } from "./roleAccent";
import type { TourStepPanelProps } from "./tourStepTypes";

/** CSS var MobileDrawer reads (falls back to 0px when unset) so its panel
 *  shrinks to sit clear above this sheet instead of the sheet covering the
 *  drawer's lower nav items and footer (profile/settings/logout) — the
 *  "agent-nav-intro"/"client-nav-intro" step spotlights the *entire* nav,
 *  and a fixed-position sheet layered on top would otherwise make whatever
 *  it happens to cover physically unreachable regardless of scrolling,
 *  since the drawer's footer sits outside the nav's own scroll box. */
const TOUR_SHEET_HEIGHT_VAR = "--tour-sheet-height";

/**
 * Mobile guided-tour step panel — a bottom sheet instead of a positioned
 * popover (there's rarely room to anchor a floating card near small-screen
 * targets). Portaled to document.body like TourPopover; ignores `rect` for
 * its own placement (it always docks to the bottom) but the Spotlight
 * component still highlights the target above it.
 *
 * The user is already standing on the real feature page by the time this
 * renders (GuidedTour navigates there first) — this panel just narrates
 * what they're looking at, it doesn't send them anywhere else.
 */
export function TourBottomSheet({
  role,
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
  const sheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const root = document.documentElement;
    const publishHeight = () => root.style.setProperty(TOUR_SHEET_HEIGHT_VAR, `${el.offsetHeight}px`);
    publishHeight();
    // ResizeObserver isn't in jsdom (or ancient browsers) — the one-shot
    // publishHeight() above still covers the common case, just without
    // tracking live height changes (e.g. a snoozed→resumed skeleton swap).
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(publishHeight) : null;
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      root.style.removeProperty(TOUR_SHEET_HEIGHT_VAR);
    };
  }, [targetStatus]);

  if (targetStatus === "timeout") return null;

  return createPortal(
    <div
      ref={(node) => {
        dialogRef.current = node;
        sheetRef.current = node;
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-sheet-title"
      className="onboard-pop fixed inset-x-0 bottom-0 z-[9999] max-h-[80vh] overflow-y-auto overscroll-contain rounded-t-2xl bg-white px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl lg:hidden"
    >
      {/* Grab handle — signals this is a sheet docked to the bottom edge. */}
      <div aria-hidden className="mx-auto mb-3 h-1 w-9 rounded-full bg-slate-200" />

      {targetStatus === "waiting" ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-2/3 rounded" />
          <Skeleton className="h-3 w-full rounded" />
          <p className="text-xs text-slate-400">{t("onboarding.waiting.message")}</p>
        </div>
      ) : (
        <div key={title} className="onboard-pop">
          {progressSlot}

          <div
            className={`onboard-rise mb-3 flex h-10 w-10 items-center justify-center rounded-full ${accent.dotInactive}`}
          >
            <Sparkles className={`h-5 w-5 ${accent.text}`} />
          </div>

          <h3 id="tour-sheet-title" className="mb-1.5 text-base font-bold text-slate-900">
            {title}
          </h3>
          <p className="mb-4 text-sm leading-relaxed text-slate-600">{description}</p>

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
        </div>
      )}
    </div>,
    document.body,
  );
}
