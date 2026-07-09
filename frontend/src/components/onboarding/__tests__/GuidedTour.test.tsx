import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { Routes, Route, useLocation } from "react-router-dom";
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

function renderTour(initialRoute: string, onTourFinished = vi.fn()) {
  return renderWithProviders(
    <Routes>
      <Route
        path="*"
        element={
          <>
            <CurrentPathProbe />
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

  it("shows a low-key resume nudge (not a warning) after following a step's CTA, then advances on continue", async () => {
    const ctaStep = agentSteps.find((s) => s.id === "agent-calculator")!;
    setActiveStep(ctaStep.id);
    renderTour(ctaStep.route);

    fireEvent.click(screen.getByText("جرّبها الآن"));

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent(ctaStep.cta!.route);
    });

    expect(screen.getByText("خذ وقتك وجرّبها كما تشاء")).toBeInTheDocument();
    expect(screen.queryByText("يبدو أنك ابتعدت عن الجولة!")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("أكمل الجولة"));

    expect(useOnboardingStore.getState().completedSteps).toContain(ctaStep.id);
    const nextStep = agentSteps[agentSteps.findIndex((s) => s.id === ctaStep.id) + 1];
    expect(useOnboardingStore.getState().activeStepId).toBe(nextStep.id);
  });

  it("shows the nav-guard warning when the user wanders to an unrelated route", () => {
    setActiveStep(agentSteps[0].id);
    renderTour("/some/unrelated/route");

    expect(screen.getByText("يبدو أنك ابتعدت عن الجولة!")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("returning from the nav-guard warning navigates back and re-shows the step panel", async () => {
    setActiveStep(agentSteps[0].id);
    renderTour("/some/unrelated/route");

    fireEvent.click(screen.getByText("العودة للخطوة الحالية"));

    await waitFor(() => {
      expect(screen.getByTestId("current-path")).toHaveTextContent(agentSteps[0].route);
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

  it("does not force the drawer open for the nav-guard 'wandered off' state", () => {
    useUIStore.setState({ drawerOpen: false });
    setActiveStep(agentSteps[0].id);
    renderTour("/some/unrelated/route");
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
