import { createPortal } from "react-dom";
import { roleAccent, type OnboardingRole } from "./roleAccent";

interface NavGuardToastProps {
  role: OnboardingRole;
  message: string;
  buttonLabel: string;
  onReturn: () => void;
}

/**
 * Floating banner used by GuidedTour's navigation-resilience logic (plan
 * §2.7-b). Reused for two tones with the same shape: a genuine "you
 * wandered off the tour" warning, and a friendly "still trying it out?"
 * nudge while the user is on a CTA's own destination — both just need a
 * message and a way back, so one component covers both instead of two
 * near-identical banners.
 */
export function NavGuardToast({ role, message, buttonLabel, onReturn }: NavGuardToastProps) {
  const accent = roleAccent[role];

  return createPortal(
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-[9999] mx-auto flex max-w-sm items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-white shadow-xl transition-all duration-200 lg:inset-x-auto lg:start-6 lg:bottom-6"
    >
      <span className="text-sm">{message}</span>
      <button
        onClick={onReturn}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-150 active:scale-[0.98] ${accent.button}`}
      >
        {buttonLabel}
      </button>
    </div>,
    document.body,
  );
}
