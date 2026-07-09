import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useUIStore } from "@/stores/uiStore";
import { authService } from "@/services/authService";
import { getTourSteps, type TourStep } from "@/constants/onboardingSteps";
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
 * Renders the active guided-tour step: a Spotlight highlight plus a
 * TourPopover (desktop) or TourBottomSheet (mobile) anchored to it.
 *
 * Three location states, since a step's target only exists on its own
 * `route` while its optional `cta` sends the user somewhere else entirely:
 *  1. on `step.route`      → full spotlight + popover/sheet as normal.
 *  2. on `step.cta.route`  → the user deliberately followed "try it now";
 *     show a low-key, positively-worded resume affordance, not a warning.
 *  3. anywhere else        → the user genuinely wandered off (an unrelated
 *     link, browser back); show the NavGuardToast "wandered off" warning
 *     (plan §2.7-b) with a button back to the step.
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

  const [awaitingReturn, setAwaitingReturn] = useState(false);
  const autoSkippedStepIdRef = useRef<string | null>(null);

  const onSameRoute = currentStep ? location.pathname === currentStep.route : false;
  const onCtaRoute = !!(currentStep?.cta && location.pathname === currentStep.cta.route);

  const targetIdForLookup = onSameRoute ? currentStep?.target ?? null : null;
  const { rect, status: targetStatus } = useTourTarget(targetIdForLookup);

  // Every current tour step targets something inside the Sidebar
  // (tour-sidebar-nav / tour-nav-*), which on mobile only exists on-screen
  // inside the MobileDrawer. Without this, useTourTarget would resolve a
  // rect that's real but translated off-screen (the drawer's closed state
  // doesn't unmount it, just slides it out) — so keep the drawer open for
  // as long as a step is active on its own route on a small screen.
  useEffect(() => {
    if (isDesktop || !onSameRoute) return;
    useUIStore.getState().openDrawer();
  }, [isDesktop, onSameRoute, currentStep]);

  function advance(step: TourStep, markComplete: boolean) {
    if (markComplete) completeStep(step.id);
    const next = steps[steps.findIndex((s) => s.id === step.id) + 1];
    setAwaitingReturn(false);
    if (next) {
      goToStep(next.id, next.route);
      if (location.pathname !== next.route) navigate(next.route);
    } else {
      completeTour();
      authService.updateOnboardingStatus("completed").catch(() => {});
      onTourFinished();
    }
  }

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
    setAwaitingReturn(false);
    goToStep(prev.id, prev.route);
    if (location.pathname !== prev.route) navigate(prev.route);
  };
  const handleCta = () => {
    if (!step.cta) return;
    setAwaitingReturn(true);
    navigate(step.cta.route);
  };
  const handleSnooze = () => {
    snooze();
    authService.updateOnboardingStatus("snoozed").catch(() => {});
  };
  const handleReturnToStep = () => {
    setAwaitingReturn(false);
    navigate(step.route);
  };

  // State 2: deliberately visiting the CTA's own destination.
  if (onCtaRoute && awaitingReturn) {
    return (
      <NavGuardToast
        role={role}
        message={t("onboarding.resume.tryingIt")}
        buttonLabel={t("onboarding.resume.continueButton")}
        onReturn={handleAdvance}
      />
    );
  }

  // State 3: somewhere else entirely — genuine "wandered off".
  if (!onSameRoute && !onCtaRoute) {
    return (
      <NavGuardToast
        role={role}
        message={t("onboarding.navGuard.message")}
        buttonLabel={t("onboarding.navGuard.returnButton")}
        onReturn={handleReturnToStep}
      />
    );
  }

  // State 1: on the expected route — full spotlight + popover/sheet.
  const panelProps = {
    role,
    rect,
    targetStatus,
    title: t(step.titleKey),
    description: t(step.descriptionKey),
    ctaLabel: step.cta ? t(step.cta.labelKey) : undefined,
    onCta: step.cta ? handleCta : undefined,
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
