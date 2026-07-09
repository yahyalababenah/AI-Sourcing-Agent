import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { roleAccent, type OnboardingRole } from "./roleAccent";

interface ProgressTrackerProps {
  /** Real number of guided-tour steps the user has completed. */
  completedCount: number;
  /** Real total number of guided-tour steps. */
  totalCount: number;
  role: OnboardingRole;
}

/**
 * Two phantom steps ("created your account", "logged in" — both already
 * true) are folded into both completed and total counts so the bar never
 * starts at 0%. Per plan review: starting a rep at ~25-30% instead of 0%
 * makes the remaining tour feel short, which matters for a non-technical
 * audience that's likely to bail on anything that looks like a long setup
 * flow.
 */
const PHANTOM_STEPS = 2;
const CELEBRATION_THRESHOLD = 60;

export function ProgressTracker({ completedCount, totalCount, role }: ProgressTrackerProps) {
  const { t } = useTranslation();
  const accent = roleAccent[role];

  const displayedCompleted = completedCount + PHANTOM_STEPS;
  const displayedTotal = totalCount + PHANTOM_STEPS;
  const percent = Math.round((displayedCompleted / displayedTotal) * 100);

  const [bump, setBump] = useState(false);
  const prevCompletedRef = useRef(completedCount);
  useEffect(() => {
    if (completedCount === prevCompletedRef.current) return;
    prevCompletedRef.current = completedCount;
    setBump(true);
    const timeoutId = setTimeout(() => setBump(false), 250);
    return () => clearTimeout(timeoutId);
  }, [completedCount]);

  return (
    <div className="mb-4" aria-live="polite">
      <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-500">
        <span>{t("onboarding.progress.label", { completed: displayedCompleted, total: displayedTotal })}</span>
        <span
          className={`font-bold transition-transform duration-150 motion-reduce:transition-none ${accent.text} ${
            bump ? "scale-125" : "scale-100"
          }`}
        >
          {percent}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-200 motion-reduce:transition-none ${accent.dot}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {percent >= CELEBRATION_THRESHOLD && percent < 100 && (
        <p className="mt-1.5 text-[11px] font-medium text-slate-500">{t("onboarding.progress.celebration")}</p>
      )}
    </div>
  );
}
