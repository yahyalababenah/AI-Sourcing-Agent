import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useUIStore } from "@/stores/uiStore";
import { authService } from "@/services/authService";
import { getTourSteps, isSidebarStep, type TourStep } from "@/constants/onboardingSteps";
import { useTourTarget } from "@/hooks/useTourTarget";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Spotlight } from "./Spotlight";
import { TourPopover } from "./TourPopover";
import { TourBottomSheet } from "./TourBottomSheet";
import { ProgressTracker } from "./ProgressTracker";
import { NavGuardToast } from "./NavGuardToast";
import type { OnboardingRole } from "./roleAccent";

interface GuidedTourProps {
  role: OnboardingRole;
  /** Called once the last step is cleared — the tour itself only flips
   *  status to "completed" and patches the backend; the celebratory
   *  completion card (T12) is the caller's responsibility. */
  onTourFinished: () => void;
}

/**
 * Renders the active guided-tour step: a Spotlight highlight on the
 * relevant sidebar link plus a TourPopover (desktop) or TourBottomSheet
 * (mobile) — while the user is actually standing on the real feature page
 * (`step.route`), not just looking at a sidebar link from the dashboard.
 * GuidedTour navigates there itself the moment a step becomes active.
 *
 * Two location states:
 *  1. on `step.route` → full spotlight + popover/sheet as normal.
 *  2. anywhere else   → the user genuinely wandered off (an unrelated
 *     link, browser back); show the NavGuardToast "wandered off" warning
 *     (plan §2.7-b) with a button back to the step. One exception: leaving
 *     the RFQ submit step means the request was just created successfully
 *     (the app navigated to its own detail page) — that's forgiveness
 *     completion, not wandering, so it advances silently instead.
 */
export function GuidedTour({ role, onTourFinished }: GuidedTourProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const status = useOnboardingStore((s) => s.status);
  const activeStepId = useOnboardingStore((s) => s.activeStepId);
  const completedSteps = useOnboardingStore((s) => s.completedSteps);
  const goToStep = useOnboardingStore((s) => s.goToStep);
  const completeStep = useOnboardingStore((s) => s.completeStep);
  const completeTour = useOnboardingStore((s) => s.completeTour);
  const snooze = useOnboardingStore((s) => s.snooze);

  const steps = useMemo(() => getTourSteps(role), [role]);
  const currentIndex = steps.findIndex((s) => s.id === activeStepId);
  const currentStep: TourStep | null = currentIndex >= 0 ? steps[currentIndex] : null;

  const autoSkippedStepIdRef = useRef<string | null>(null);
  const navigatedForStepIdRef = useRef<string | null>(null);
  const rfqSubmitAdvancedRef = useRef(false);

  const onSameRoute = currentStep ? location.pathname === currentStep.route : false;

  const targetIdForLookup = onSameRoute ? currentStep?.target ?? null : null;
  const { rect, status: targetStatus } = useTourTarget(targetIdForLookup);

  // Take the user *into* each feature as soon as its step becomes active —
  // per feedback, the tour shouldn't just point at a sidebar link from the
  // dashboard and wait for a click. One navigate per step (guarded by ref)
  // so a manual detour back to the dashboard doesn't get yanked away again.
  useEffect(() => {
    if (!currentStep) return;
    if (navigatedForStepIdRef.current === currentStep.id) return;
    navigatedForStepIdRef.current = currentStep.id;
    if (location.pathname !== currentStep.route) navigate(currentStep.route);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // Mobile drawer choreography. Sidebar-anchored steps (tour-sidebar-nav /
  // tour-nav-*) live inside the MobileDrawer, which stays translated (not
  // unmounted) when closed — so useTourTarget would otherwise resolve a real
  // but off-screen rect. Open the drawer for those. But the page-anchored
  // mini-walkthrough steps (tour-calc-* / tour-rfq-*) target fields *on the
  // page underneath*; an open 270px drawer would slide in and cover the very
  // field being highlighted (the reported bug). Close it for those so the
  // field is visible and tappable.
  useEffect(() => {
    if (isDesktop || !onSameRoute || !currentStep) return;
    const ui = useUIStore.getState();
    if (isSidebarStep(currentStep)) ui.openDrawer();
    else ui.closeDrawer();
  }, [isDesktop, onSameRoute, currentStep]);

  // Bring the highlighted target into the visible band on mobile: nav items
  // can sit below the fold inside the drawer's scroll, and on-page fields can
  // be hidden behind the docked bottom sheet. Desktop popovers reposition
  // themselves, so this is mobile-only. Waits out the drawer's open/close
  // transition first, then centres the target (scrollIntoView walks every
  // scrollable ancestor, so it handles both the drawer nav and the window).
  useEffect(() => {
    if (isDesktop || !onSameRoute || !currentStep || targetStatus !== "found") return;
    const selector = `[data-tour="${currentStep.target}"]`;
    const id = window.setTimeout(() => {
      const el = Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
        (n) => n.offsetWidth > 0 || n.offsetHeight > 0,
      );
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 240);
    return () => window.clearTimeout(id);
  }, [isDesktop, onSameRoute, currentStep, targetStatus]);

  function advance(step: TourStep, markComplete: boolean) {
    if (markComplete) completeStep(step.id);
    const next = steps[steps.findIndex((s) => s.id === step.id) + 1];
    if (next) {
      goToStep(next.id, next.route);
    } else {
      completeTour();
      authService.updateOnboardingStatus("completed").catch(() => {});
      onTourFinished();
    }
  }

  // Forgiveness completion path for the calculator step specifically (plan
  // review): reaching the calculator page already lets the user advance via
  // the "التالي" button, but the plan calls out that actually entering a
  // value should *also* complete it — a genuine interaction is a stronger
  // completion cue than just landing on the page, and it saves a click.
  useEffect(() => {
    if (!currentStep || currentStep.id !== "agent-calculator" || !onSameRoute) return;

    function handleInput() {
      if (currentStep) advance(currentStep, true);
    }
    document.addEventListener("input", handleInput, { once: true });
    return () => document.removeEventListener("input", handleInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, onSameRoute]);

  // Forgiveness completion path for the RFQ submit step: submitting the
  // form navigates to the newly created request's own detail page
  // (ROUTES.RFQ.DETAIL(id), a dynamic route the tour doesn't know about) —
  // that's a *success*, not the user wandering off. Detect leaving
  // step.route while on this step and advance instead of warning.
  useEffect(() => {
    if (!currentStep || currentStep.id !== "client-rfq-submit") return;
    if (onSameRoute) {
      rfqSubmitAdvancedRef.current = false;
      return;
    }
    if (rfqSubmitAdvancedRef.current) return;
    rfqSubmitAdvancedRef.current = true;
    advance(currentStep, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, onSameRoute]);

  // Auto-skip a step whose target never renders (plan §2.7-a) — mark it
  // complete anyway so progress keeps moving; there's nothing the user can
  // do about a DOM element that never shows up. Guarded by a ref (not a
  // dependency-complete effect) because `advance` is a fresh closure every
  // render — including it in the deps array would re-fire this on every
  // unrelated re-render while status stays "timeout", not just once.
  useEffect(() => {
    if (!currentStep || !onSameRoute) return;
    if (targetStatus !== "timeout") return;
    if (autoSkippedStepIdRef.current === currentStep.id) return;
    autoSkippedStepIdRef.current = currentStep.id;
    advance(currentStep, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetStatus, currentStep, onSameRoute]);

  if (status !== "active" || !currentStep) return null;
  const step = currentStep;

  const handleAdvance = () => advance(step, true);
  const handleSkipStep = () => advance(step, false);
  const handleBack = () => {
    const prev = steps[currentIndex - 1];
    if (!prev) return;
    goToStep(prev.id, prev.route);
  };
  const handleSnooze = () => {
    snooze();
    authService.updateOnboardingStatus("snoozed").catch(() => {});
  };
  const handleReturnToStep = () => {
    navigate(step.route);
  };

  // The user genuinely wandered off (an unrelated link, browser back) —
  // except leaving the RFQ submit step, which means the request was just
  // created successfully (see the forgiveness effect above); render
  // nothing for that one tick while it advances instead of warning.
  if (!onSameRoute && step.id !== "client-rfq-submit") {
    return (
      <NavGuardToast
        role={role}
        message={t("onboarding.navGuard.message")}
        buttonLabel={t("onboarding.navGuard.returnButton")}
        onReturn={handleReturnToStep}
      />
    );
  }
  if (!onSameRoute) return null;

  const panelProps = {
    role,
    rect,
    targetStatus,
    title: t(step.titleKey),
    description: t(step.descriptionKey),
    onNext: handleAdvance,
    onBack: handleBack,
    onSkipStep: handleSkipStep,
    onSnooze: handleSnooze,
    onFinish: handleAdvance,
    isFirst: currentIndex === 0,
    isLast: currentIndex === steps.length - 1,
    progressSlot: (
      <ProgressTracker completedCount={completedSteps.length} totalCount={steps.length} role={role} />
    ),
  };

  return (
    <>
      <Spotlight rect={rect} />
      {isDesktop ? <TourPopover {...panelProps} /> : <TourBottomSheet {...panelProps} />}
    </>
  );
}
