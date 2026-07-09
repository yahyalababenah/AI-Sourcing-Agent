import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { authService } from "@/services/authService";
import { getWelcomeSlides, getTourSteps } from "@/constants/onboardingSteps";
import { WelcomeCarousel } from "./WelcomeCarousel";
import { GuidedTour } from "./GuidedTour";
import type { OnboardingRole } from "./roleAccent";

const SESSION_KEY = "ai-sourcing-onboarding-session-checked";

interface OnboardingProviderProps {
  role: OnboardingRole;
}

/**
 * Mounted once per role layout (AgentLayout/ClientLayout). Reconciles the
 * onboarding store with the backend's onboarding_status (source of truth
 * across devices, see plan §2.2.1) and shows the post-login welcome
 * carousel when appropriate.
 *
 * The welcome carousel is only offered once per browser session even if
 * status stays "pending"/"snoozed" — this provider stays mounted across
 * every route change in the SPA, so without a session guard it would try
 * to reopen on each navigation instead of once after login.
 */
export function OnboardingProvider({ role }: OnboardingProviderProps) {
  const user = useAuthStore((s) => s.user);
  const initFor = useOnboardingStore((s) => s.initFor);
  const startTour = useOnboardingStore((s) => s.startTour);
  const snooze = useOnboardingStore((s) => s.snooze);
  const skipForever = useOnboardingStore((s) => s.skipForever);

  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const reconciledRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    initFor(user.id, role);

    if (reconciledRef.current) return;
    reconciledRef.current = true;

    const alreadyShownThisSession = sessionStorage.getItem(SESSION_KEY) === user.id;
    const backendStatus = user.onboarding_status;

    useOnboardingStore.setState({
      status: backendStatus,
      hasSeenWelcome: backendStatus !== "pending" && backendStatus !== "snoozed",
    });

    if (!alreadyShownThisSession && (backendStatus === "pending" || backendStatus === "snoozed")) {
      sessionStorage.setItem(SESSION_KEY, user.id);
      setWelcomeVisible(true);
    }
  }, [user, role, initFor]);

  if (!user) return null;

  if (welcomeVisible) {
    const slides = getWelcomeSlides(role);
    if (slides.length === 0) return null;

    const handleStartTour = () => {
      setWelcomeVisible(false);
      const [firstStep] = getTourSteps(role);
      if (firstStep) startTour(firstStep.id, firstStep.route);
      authService.updateOnboardingStatus("active").catch(() => {});
    };

    const handleSnooze = () => {
      setWelcomeVisible(false);
      snooze();
      authService.updateOnboardingStatus("snoozed").catch(() => {});
    };

    const handleSkipForever = () => {
      setWelcomeVisible(false);
      skipForever();
      authService.updateOnboardingStatus("skipped").catch(() => {});
    };

    return (
      <WelcomeCarousel
        role={role}
        slides={slides}
        onStartTour={handleStartTour}
        onSnooze={handleSnooze}
        onSkipForever={handleSkipForever}
      />
    );
  }

  // GuidedTour self-guards on status !== "active", so it's safe to always
  // mount it here once the welcome carousel isn't showing.
  return <GuidedTour role={role} onTourFinished={() => {}} />;
}
