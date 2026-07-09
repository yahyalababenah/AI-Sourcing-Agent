import { describe, expect, it, beforeEach } from "vitest";
import { useOnboardingStore } from "../onboardingStore";

function reset() {
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
  });
}

describe("onboardingStore", () => {
  beforeEach(() => {
    reset();
  });

  it("initializes pending state for a fresh user", () => {
    useOnboardingStore.getState().initFor("user-1", "agent");
    const state = useOnboardingStore.getState();
    expect(state.userId).toBe("user-1");
    expect(state.role).toBe("agent");
    expect(state.status).toBe("pending");
    expect(state.hasSeenWelcome).toBe(false);
  });

  it("resets progress when a different user logs in on the same browser", () => {
    useOnboardingStore.getState().initFor("user-1", "agent");
    useOnboardingStore.getState().completeStep("step-1");
    expect(useOnboardingStore.getState().completedSteps).toEqual(["step-1"]);

    useOnboardingStore.getState().initFor("user-2", "client");
    const state = useOnboardingStore.getState();
    expect(state.userId).toBe("user-2");
    expect(state.completedSteps).toEqual([]);
    expect(state.status).toBe("pending");
  });

  it("preserves progress on re-init for the same user", () => {
    useOnboardingStore.getState().initFor("user-1", "agent");
    useOnboardingStore.getState().completeStep("step-1");
    useOnboardingStore.getState().initFor("user-1", "agent");
    expect(useOnboardingStore.getState().completedSteps).toEqual(["step-1"]);
  });

  it("starts the tour and sets the expected route", () => {
    useOnboardingStore.getState().startTour("step-1", "/agent/dashboard");
    const state = useOnboardingStore.getState();
    expect(state.hasSeenWelcome).toBe(true);
    expect(state.status).toBe("active");
    expect(state.activeStepId).toBe("step-1");
    expect(state.expectedRoute).toBe("/agent/dashboard");
  });

  it("moves between steps via goToStep", () => {
    useOnboardingStore.getState().startTour("step-1", "/agent/dashboard");
    useOnboardingStore.getState().goToStep("step-2", "/agent/calculator");
    const state = useOnboardingStore.getState();
    expect(state.activeStepId).toBe("step-2");
    expect(state.expectedRoute).toBe("/agent/calculator");
  });

  it("completeStep is idempotent", () => {
    useOnboardingStore.getState().completeStep("step-1");
    useOnboardingStore.getState().completeStep("step-1");
    expect(useOnboardingStore.getState().completedSteps).toEqual(["step-1"]);
  });

  it("snooze clears active step but keeps completed steps, sets snoozedAt", () => {
    useOnboardingStore.getState().startTour("step-1", "/x");
    useOnboardingStore.getState().completeStep("step-1");
    useOnboardingStore.getState().snooze();
    const state = useOnboardingStore.getState();
    expect(state.status).toBe("snoozed");
    expect(state.activeStepId).toBeNull();
    expect(state.expectedRoute).toBeNull();
    expect(state.completedSteps).toEqual(["step-1"]);
    expect(state.snoozedAt).not.toBeNull();
  });

  it("skipForever sets status to skipped and does not auto-resume", () => {
    useOnboardingStore.getState().startTour("step-1", "/x");
    useOnboardingStore.getState().skipForever();
    expect(useOnboardingStore.getState().status).toBe("skipped");
  });

  it("completeTour sets status to completed", () => {
    useOnboardingStore.getState().startTour("step-1", "/x");
    useOnboardingStore.getState().completeTour();
    const state = useOnboardingStore.getState();
    expect(state.status).toBe("completed");
    expect(state.activeStepId).toBeNull();
  });

  it("resetTour returns to a clean pending state", () => {
    useOnboardingStore.getState().startTour("step-1", "/x");
    useOnboardingStore.getState().completeStep("step-1");
    useOnboardingStore.getState().completeTour();
    useOnboardingStore.getState().resetTour();
    const state = useOnboardingStore.getState();
    expect(state.status).toBe("pending");
    expect(state.hasSeenWelcome).toBe(false);
    expect(state.completedSteps).toEqual([]);
  });
});
