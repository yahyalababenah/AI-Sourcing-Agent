import { describe, expect, it, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { WelcomeCarouselDesktop } from "../WelcomeCarouselDesktop";
import "@/lib/i18n";

const slides = [
  { id: "s1", titleKey: "onboarding.welcome.agent.cost.title", descriptionKey: "onboarding.welcome.agent.cost.description" },
  { id: "s2", titleKey: "onboarding.welcome.agent.catalog.title", descriptionKey: "onboarding.welcome.agent.catalog.description" },
];

describe("WelcomeCarouselDesktop", () => {
  it("shows the first slide and advances to the next on click", () => {
    renderWithProviders(
      <WelcomeCarouselDesktop role="agent" slides={slides} onStartTour={vi.fn()} onSnooze={vi.fn()} onSkipForever={vi.fn()} />,
    );
    expect(screen.getByText("احسب التكلفة الواصلة بثقة")).toBeInTheDocument();

    fireEvent.click(screen.getByText("التالي"));
    expect(screen.getByText("حوّل كتالوجك لمنتجات بضغطة")).toBeInTheDocument();
  });

  it("shows 'ابدأ الجولة' instead of 'التالي' on the last slide and calls onStartTour", () => {
    const onStartTour = vi.fn();
    renderWithProviders(
      <WelcomeCarouselDesktop role="agent" slides={slides} onStartTour={onStartTour} onSnooze={vi.fn()} onSkipForever={vi.fn()} />,
    );
    fireEvent.click(screen.getByText("التالي"));
    const startButton = screen.getByText("ابدأ الجولة");
    fireEvent.click(startButton);
    expect(onStartTour).toHaveBeenCalledTimes(1);
  });

  it("calls onSnooze and onSkipForever from their respective controls", () => {
    const onSnooze = vi.fn();
    const onSkipForever = vi.fn();
    renderWithProviders(
      <WelcomeCarouselDesktop role="agent" slides={slides} onStartTour={vi.fn()} onSnooze={onSnooze} onSkipForever={onSkipForever} />,
    );
    fireEvent.click(screen.getByText("ذكّرني لاحقاً"));
    expect(onSnooze).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("تخطّي نهائياً"));
    expect(onSkipForever).toHaveBeenCalledTimes(1);
  });

  it("uses the importer accent color for the client role", () => {
    const { container } = renderWithProviders(
      <WelcomeCarouselDesktop role="client" slides={slides} onStartTour={vi.fn()} onSnooze={vi.fn()} onSkipForever={vi.fn()} />,
    );
    expect(container.querySelector(".bg-importer-500")).toBeInTheDocument();
    expect(container.querySelector(".bg-supplier-500")).not.toBeInTheDocument();
  });

  it("renders as an accessible dialog", () => {
    renderWithProviders(
      <WelcomeCarouselDesktop role="agent" slides={slides} onStartTour={vi.fn()} onSnooze={vi.fn()} onSkipForever={vi.fn()} />,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
