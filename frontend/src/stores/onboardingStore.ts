import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserRole } from "@/types/auth";

/**
 * Lifecycle of the onboarding experience for a given user.
 * `snoozed` differs from `skipped`: snoozed tours resume automatically on
 * the next login session, skipped tours only come back via manual restart
 * (see /settings "restart tour").
 */
export type TourStatus = "pending" | "active" | "snoozed" | "completed" | "skipped";

interface OnboardingState {
  /** Which user this state belongs to — persisted state is scoped per-user
   *  (see persist `name` below) but this field guards against stale reads
   *  after a fast user switch on the same browser. */
  userId: string | null;
  role: UserRole | null;
  hasSeenWelcome: boolean;
  status: TourStatus;
  activeStepId: string | null;
  /** The route the current tour step expects the user to be on — used by
   *  navigation-resilience logic to detect when the user wandered off. */
  expectedRoute: string | null;
  completedSteps: string[];
  snoozedAt: string | null;
  /** Bumped by resetTour() so OnboardingProvider (mounted once for the whole
   *  SPA session) can distinguish a deliberate "restart tour" settings
   *  action from status merely already being "pending" for other reasons
   *  (e.g. the initial backend reconciliation on mount). */
  restartSignal: number;

  /** Initializes state for a freshly authenticated user (called once role/id are known). */
  initFor: (userId: string, role: UserRole) => void;
  /** Marks the welcome carousel as seen and begins the guided tour. */
  startTour: (firstStepId: string, firstStepRoute: string | null) => void;
  /** Advances to a given step id, updating the expected route. */
  goToStep: (stepId: string, route: string | null) => void;
  /** Marks a step complete (idempotent) and adds it to the progress list. */
  completeStep: (stepId: string) => void;
  /** Defers the tour to the next login session. */
  snooze: () => void;
  /** Permanently dismisses the tour; only a manual restart brings it back. */
  skipForever: () => void;
  /** Finishes the tour successfully. */
  completeTour: () => void;
  /** Re-arms the tour from scratch (used by the "restart tour" settings action). */
  resetTour: () => void;
  /** Clears `expectedRoute` mismatch state after the user has been guided back. */
  resumeFromNav: () => void;
}

const initialProgressState = {
  hasSeenWelcome: false,
  status: "pending" as TourStatus,
  activeStepId: null,
  expectedRoute: null,
  completedSteps: [],
  snoozedAt: null,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      userId: null,
      role: null,
      restartSignal: 0,
      ...initialProgressState,

      initFor: (userId, role) => {
        const current = get();
        // Different user on the same browser — reset to a clean pending state.
        if (current.userId !== userId) {
          set({ userId, role, ...initialProgressState });
        } else {
          set({ role });
        }
      },

      startTour: (firstStepId, firstStepRoute) => {
        set({
          hasSeenWelcome: true,
          status: "active",
          activeStepId: firstStepId,
          expectedRoute: firstStepRoute,
        });
      },

      goToStep: (stepId, route) => {
        set({ activeStepId: stepId, expectedRoute: route, status: "active" });
      },

      completeStep: (stepId) => {
        const { completedSteps } = get();
        if (completedSteps.includes(stepId)) return;
        set({ completedSteps: [...completedSteps, stepId] });
      },

      snooze: () => {
        set({ status: "snoozed", snoozedAt: new Date().toISOString(), activeStepId: null, expectedRoute: null });
      },

      skipForever: () => {
        set({ status: "skipped", activeStepId: null, expectedRoute: null });
      },

      completeTour: () => {
        set({ status: "completed", activeStepId: null, expectedRoute: null });
      },

      resetTour: () => {
        set((s) => ({ ...initialProgressState, status: "pending", restartSignal: s.restartSignal + 1 }));
      },

      resumeFromNav: () => {
        // No-op state change hook: navigation resilience is driven by the
        // component watching `expectedRoute` vs the router location; this
        // exists so callers have a single action to invoke on "return to
        // tour" without reaching into internals.
        set((s) => ({ activeStepId: s.activeStepId }));
      },
    }),
    {
      name: "ai-sourcing-onboarding",
      partialize: (state) => ({
        userId: state.userId,
        role: state.role,
        hasSeenWelcome: state.hasSeenWelcome,
        status: state.status,
        activeStepId: state.activeStepId,
        expectedRoute: state.expectedRoute,
        completedSteps: state.completedSteps,
        snoozedAt: state.snoozedAt,
      }),
    },
  ),
);
