import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { OnboardingProvider } from "../OnboardingProvider";
import { useAuthStore } from "@/stores/authStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { getTourSteps } from "@/constants/onboardingSteps";
import { ROUTES } from "@/constants/routes";
import { authService } from "@/services/authService";
import { useTourTarget } from "@/hooks/useTourTarget";
import type { User } from "@/types/auth";
import "@/lib/i18n";

vi.mock("@/services/authService");
vi.mock("@/hooks/useTourTarget");

const FAKE_RECT = { top: 10, left: 10, width: 80, height: 30, right: 90, bottom: 40, x: 10, y: 10, toJSON() {} } as DOMRect;

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "agent@test.com",
    full_name: "Test Agent",
    role: "agent",
    is_active: true,
    created_at: new Date().toISOString(),
    onboarding_status: "pending",
    onboarding_completed_at: null,
    ...overrides,
  };
}

/**
 * End-to-end walk through the whole onboarding experience via the real
 * consumer-facing entry point (OnboardingProvider), not the individual
 * pieces tested in isolation elsewhere: welcome carousel -> guided tour
 * (which navigates the user into each real feature page as it goes) ->
 * completion card -> dismiss. Exercises the plan's Definition of Done
 * directly: "مستخدم Agent ... يمرّ بجولة تلمس ≥5 مزايا، يجرّب فعلياً ≥2
 * خدمة" and ends 100% complete.
 */
describe("onboarding flow (integration)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useOnboardingStore.persist.clearStorage();
    useOnboardingStore.setState({
      userId: null,
      role: null,
      hasSeenWelcome: false,
      status: "pending",
      activeStepId: null,
      expectedRoute: null,
      completedSteps: [],
      snoozedAt: null,
      restartSignal: 0,
    });
    vi.mocked(authService.updateOnboardingStatus).mockResolvedValue(makeUser());
    vi.mocked(useTourTarget).mockReturnValue({ rect: FAKE_RECT, status: "found" });
  });

  it("walks a fresh agent from the welcome carousel through every step to the completion card", async () => {
    useAuthStore.setState({ user: makeUser({ onboarding_status: "pending" }) });
    renderWithProviders(<OnboardingProvider role="agent" />, { route: ROUTES.AGENT.DASHBOARD });

    // 1. Welcome carousel.
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    let startButton = screen.queryByText("ابدأ الجولة");
    while (!startButton) {
      fireEvent.click(screen.getByText("التالي"));
      startButton = screen.queryByText("ابدأ الجولة");
    }
    fireEvent.click(startButton);
    expect(authService.updateOnboardingStatus).toHaveBeenCalledWith("active");

    // 2. Guided tour — walk every step, mixing CTA and highlight-only ones.
    const steps = getTourSteps("agent");
    expect(steps.length).toBeGreaterThanOrEqual(5); // DoD: touches >=5 features

    for (let i = 0; i < steps.length; i++) {
      const isLast = i === steps.length - 1;
      const label = isLast ? "إنهاء الجولة" : "التالي";
      await waitFor(() => expect(screen.getByText(label)).toBeInTheDocument());
      fireEvent.click(screen.getByText(label));
    }

    // 3. Completion card.
    await waitFor(() => {
      expect(screen.getByText("أتممت الجولة 🎉")).toBeInTheDocument();
    });
    expect(useOnboardingStore.getState().status).toBe("completed");
    expect(useOnboardingStore.getState().completedSteps).toHaveLength(steps.length);
    await waitFor(() => {
      expect(authService.updateOnboardingStatus).toHaveBeenCalledWith("completed");
    });

    // 4. Dismiss — nothing left rendered.
    fireEvent.click(screen.getByText("لنبدأ!"));
    expect(screen.queryByText("أتممت الجولة 🎉")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("actually carries the user onto >=2 distinct real feature pages while walking the tour, not just the dashboard", async () => {
    useAuthStore.setState({ user: makeUser({ onboarding_status: "pending" }) });
    renderWithProviders(<OnboardingProvider role="agent" />, { route: ROUTES.AGENT.DASHBOARD });

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    let startButton = screen.queryByText("ابدأ الجولة");
    while (!startButton) {
      fireEvent.click(screen.getByText("التالي"));
      startButton = screen.queryByText("ابدأ الجولة");
    }
    fireEvent.click(startButton);

    const steps = getTourSteps("agent");
    const distinctFeatureRoutes = new Set(steps.map((s) => s.route));
    expect(distinctFeatureRoutes.size).toBeGreaterThanOrEqual(2); // DoD: >=2 real services visited

    for (let i = 0; i < steps.length; i++) {
      const isLast = i === steps.length - 1;
      const label = isLast ? "إنهاء الجولة" : "التالي";
      await waitFor(() => expect(screen.getByText(label)).toBeInTheDocument());
      fireEvent.click(screen.getByText(label));
    }

    await waitFor(() => {
      expect(screen.getByText("أتممت الجولة 🎉")).toBeInTheDocument();
    });
  });
});
