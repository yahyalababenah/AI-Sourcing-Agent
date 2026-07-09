import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { OnboardingProvider } from "../OnboardingProvider";
import { useAuthStore } from "@/stores/authStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { authService } from "@/services/authService";
import type { User } from "@/types/auth";
import "@/lib/i18n";

vi.mock("@/services/authService");

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

describe("OnboardingProvider", () => {
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
    });
    vi.mocked(authService.updateOnboardingStatus).mockResolvedValue(makeUser());
  });

  it("shows the welcome carousel when backend status is pending", async () => {
    useAuthStore.setState({ user: makeUser({ onboarding_status: "pending" }) });
    renderWithProviders(<OnboardingProvider role="agent" />);
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("shows the welcome carousel when backend status is snoozed (resumes next session)", async () => {
    useAuthStore.setState({ user: makeUser({ onboarding_status: "snoozed" }) });
    renderWithProviders(<OnboardingProvider role="agent" />);
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("does not show the carousel when status is completed or skipped", async () => {
    useAuthStore.setState({ user: makeUser({ onboarding_status: "completed" }) });
    renderWithProviders(<OnboardingProvider role="agent" />);
    await waitFor(() => {
      expect(useOnboardingStore.getState().status).toBe("completed");
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not reopen within the same browser session once already shown", async () => {
    sessionStorage.setItem("ai-sourcing-onboarding-session-checked", "user-1");
    useAuthStore.setState({ user: makeUser({ onboarding_status: "pending" }) });
    renderWithProviders(<OnboardingProvider role="agent" />);
    await waitFor(() => {
      expect(useOnboardingStore.getState().status).toBe("pending");
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls updateOnboardingStatus('snoozed') and hides the carousel on snooze", async () => {
    useAuthStore.setState({ user: makeUser({ onboarding_status: "pending" }) });
    renderWithProviders(<OnboardingProvider role="agent" />);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.click(screen.getByText("ذكّرني لاحقاً"));

    expect(authService.updateOnboardingStatus).toHaveBeenCalledWith("snoozed");
    expect(useOnboardingStore.getState().status).toBe("snoozed");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls updateOnboardingStatus('skipped') on skip-forever", async () => {
    useAuthStore.setState({ user: makeUser({ onboarding_status: "pending" }) });
    renderWithProviders(<OnboardingProvider role="agent" />);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.click(screen.getByText("تخطّي نهائياً"));

    expect(authService.updateOnboardingStatus).toHaveBeenCalledWith("skipped");
    expect(useOnboardingStore.getState().status).toBe("skipped");
  });

  it("starts the tour and calls updateOnboardingStatus('active') on start", async () => {
    useAuthStore.setState({ user: makeUser({ onboarding_status: "pending" }) });
    renderWithProviders(<OnboardingProvider role="agent" />);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    // Click through all slides to the final "start tour" button.
    let startButton = screen.queryByText("ابدأ الجولة");
    while (!startButton) {
      fireEvent.click(screen.getByText("التالي"));
      startButton = screen.queryByText("ابدأ الجولة");
    }
    fireEvent.click(startButton);

    expect(authService.updateOnboardingStatus).toHaveBeenCalledWith("active");
    expect(useOnboardingStore.getState().status).toBe("active");
    expect(useOnboardingStore.getState().activeStepId).not.toBeNull();
  });
});
