import type { ReactNode } from "react";
import type { TourTargetStatus } from "@/hooks/useTourTarget";
import type { OnboardingRole } from "./roleAccent";

/** Shared prop contract for TourPopover (desktop) and TourBottomSheet
 *  (mobile) — kept as one type so GuidedTour (T9) can switch between the
 *  two without duplicating its call site. */
export interface TourStepPanelProps {
  role: OnboardingRole;
  rect: DOMRect | null;
  targetStatus: TourTargetStatus;
  title: string;
  description: string;
  onNext: () => void;
  onBack: () => void;
  onSkipStep: () => void;
  onSnooze: () => void;
  /** Called instead of onNext when the user is on the last step and presses the primary button. */
  onFinish: () => void;
  isFirst: boolean;
  isLast: boolean;
  /** Rendered above the controls — the ProgressTracker from T8. */
  progressSlot?: ReactNode;
}
