import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { renderWithProviders } from "@/test/renderWithProviders";
import { GuidedTour } from "../GuidedTour";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { getTourSteps } from "@/constants/onboardingSteps";
import { ROUTES } from "@/constants/routes";
import { authService } from "@/services/authService";
import { useTourTarget } from "@/hooks/useTourTarget";
import { useUIStore } from "@/stores/uiStore";
import "@/lib/i18n";

vi.mock("@/services/authService");
vi.mock("@/hooks/useTourTarget");

const FAKE_RECT = { top: 10, left: 10, width: 80, height: 30, right: 90, bottom: 40, x: 10, y: 10, toJSON() {} } as DOMRect;

const agentSteps = getTourSteps("agent");

function setActiveStep(stepId: string) {
  const step = agentSteps.find((s) => s.id === stepId)!;
  useOnboardingStore.setState({
    userId: "user-1",
    role: "agent",
    hasSeenWelcome: true,
    status: "active",
    activeStepId: step.id,
    expectedRoute: step.route,
    completedSteps: [],
    snoozedAt: null,
  });
}

function CurrentPathProbe() {
  const location = useLocation();
  return <div data-testid="current-path">{location.pathname}</div>;
}

/** Simulates the user clicking some unrelated link (not one of GuidedTour's
 *  own controls) — the only way to distinguish real wandering from the
 *  tour's own one-navigate-per-step effect in a test. */
function WanderAwayTrigger() {
  const navigate = useNavigate();
  return (
    <button data-testid="wander-away" onClick={() => navigate("/some/unrelated/route")}>
      wander away
    </button>
  );
}

function renderTour(initialRoute: string, onTourFinished = vi.fn()) {
  return renderWithProviders(
    <Routes>
      <Route
        path="*"
        element={
          <>
            <CurrentPathProbe />
            <WanderAwayTrigger />
            <GuidedTour role="agent" onTourFinished={onTourFinished} />
          </>
        }
      />
    </Routes>,
    { route: initialRoute },
  );
}

describe("GuidedTour", () => {
  beforeEach(() => {
    vi.mocked(authService.updateOnboardingStatus).mockResolvedValue({} as any);
    vi.mocked(useTourTarget).mockReturnValue({ rect: FAKE_RECT, status: "found" });
    useOnboardingStore.persist.clearStorage();
  });

  it("renders the current step's title/description when on the expected route", () => {
    setActiveStep(agentSteps[0].id);
    renderTour(ROUTES.AGENT.DASHBOARD);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders nothing when status is not 'active'", () => {
    setActiveStep(agentSteps[0].id);
    useOnboardingStore.setState({ status: "completed" });
    renderTour(ROUTES.AGENT.DASHBOARD);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("advances to the next step and marks the current one complete on 'next'", () => {
    setActiveStep(agentSteps[0].id);
    renderTour(ROUTES.AGENT.DASHBOARD);

    fireEvent.click(screen.getByText("التالي"));

    expect(useOnboardingStore.getState().completedSteps).toContain(agentSteps[0].id);
    expect(useOnboardingStore.getState().activeStepId).toBe(agentSteps[1].id);
  });

  it("navigates the user into the real feature page as soon as its step becomes active, instead of just pointing at it from the dashboard", async () => {
    const featureStep = agentSteps.find((s) => s.id === "agent-calculator")!;
    // Start on the dashboard with an earlier step active...
    setActiveStep(agentSteps[0].id);
    renderTour(ROUTES.AGENT.DASHBOARD);

    // ...advance past it, and the tour should carry the user onto the
    // calculator's own route automatically — no separate "try it" click.
    fireEvent.click(screen.getByText("التالي"));

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent(featureStep.route);
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("auto-completes the calculator step the moment the user types anything on its page (T11 forgiveness)", async () => {
    const calculatorStep = agentSteps.find((s) => s.id === "agent-calculator")!;
    setActiveStep(calculatorStep.id);
    renderTour(calculatorStep.route);

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    // No click on "التالي" — a bare input event anywhere on the page
    // should be enough to advance, per the plan's forgiveness rule.
    document.dispatchEvent(new Event("input", { bubbles: true }));

    await waitFor(() => {
      expect(useOnboardingStore.getState().completedSteps).toContain(calculatorStep.id);
    });
    const nextStep = agentSteps[agentSteps.findIndex((s) => s.id === calculatorStep.id) + 1];
    expect(useOnboardingStore.getState().activeStepId).toBe(nextStep.id);
  });

  it("shows the nav-guard warning when the user wanders to an unrelated route", async () => {
    setActiveStep(agentSteps[0].id);
    renderTour(ROUTES.AGENT.DASHBOARD);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("wander-away"));

    expect(screen.getByText("يبدو أنك ابتعدت عن الجولة!")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("returning from the nav-guard warning navigates back and re-shows the step panel", async () => {
    setActiveStep(agentSteps[0].id);
    renderTour(ROUTES.AGENT.DASHBOARD);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("wander-away"));
    await waitFor(() => expect(screen.getByText("يبدو أنك ابتعدت عن الجولة!")).toBeInTheDocument());

    fireEvent.click(screen.getByText("العودة للخطوة الحالية"));

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent(agentSteps[0].route);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("auto-skips (and marks complete) a step whose target times out", async () => {
    // Only the first step's target times out; later steps resolve normally
    // so we can assert one clean auto-skip instead of a cascading one.
    vi.mocked(useTourTarget)
      .mockReturnValueOnce({ rect: null, status: "timeout" })
      .mockReturnValue({ rect: FAKE_RECT, status: "found" });
    setActiveStep(agentSteps[0].id);
    renderTour(ROUTES.AGENT.DASHBOARD);

    await waitFor(() => {
      expect(useOnboardingStore.getState().completedSteps).toContain(agentSteps[0].id);
      expect(useOnboardingStore.getState().activeStepId).toBe(agentSteps[1].id);
    });
  });

  it("completes the tour and notifies the caller on the last step's finish button", async () => {
    const onTourFinished = vi.fn();
    const lastStep = agentSteps[agentSteps.length - 1];
    setActiveStep(lastStep.id);
    renderTour(lastStep.route, onTourFinished);

    fireEvent.click(screen.getByText("إنهاء الجولة"));

    expect(useOnboardingStore.getState().status).toBe("completed");
    await waitFor(() => {
      expect(authService.updateOnboardingStatus).toHaveBeenCalledWith("completed");
    });
    expect(onTourFinished).toHaveBeenCalledTimes(1);
  });

  it("opens the mobile drawer while a step is active on its own route (jsdom defaults to the mobile breakpoint)", () => {
    useUIStore.setState({ drawerOpen: false });
    setActiveStep(agentSteps[0].id);
    renderTour(ROUTES.AGENT.DASHBOARD);
    expect(useUIStore.getState().drawerOpen).toBe(true);
  });

  it("does not force the drawer open for the nav-guard 'wandered off' state", async () => {
    setActiveStep(agentSteps[0].id);
    renderTour(ROUTES.AGENT.DASHBOARD);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    useUIStore.setState({ drawerOpen: false });
    fireEvent.click(screen.getByTestId("wander-away"));

    await waitFor(() => expect(screen.getByText("يبدو أنك ابتعدت عن الجولة!")).toBeInTheDocument());
    expect(useUIStore.getState().drawerOpen).toBe(false);
  });

  it("'skip this step' advances without marking the step complete", () => {
    setActiveStep(agentSteps[0].id);
    renderTour(ROUTES.AGENT.DASHBOARD);

    fireEvent.click(screen.getByText("تخطّي هذه الخطوة"));

    expect(useOnboardingStore.getState().completedSteps).not.toContain(agentSteps[0].id);
    expect(useOnboardingStore.getState().activeStepId).toBe(agentSteps[1].id);
  });
});
