import { describe, expect, it, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { WelcomeCarouselMobile } from "../WelcomeCarouselMobile";
import "@/lib/i18n";

const slides = [
  { id: "s1", titleKey: "onboarding.welcome.client.discover.title", descriptionKey: "onboarding.welcome.client.discover.description" },
  { id: "s2", titleKey: "onboarding.welcome.client.rfq.title", descriptionKey: "onboarding.welcome.client.rfq.description" },
];

describe("WelcomeCarouselMobile", () => {
  it("shows the first slide and advances via the primary button", () => {
    renderWithProviders(
      <WelcomeCarouselMobile role="client" slides={slides} onStartTour={vi.fn()} onSnooze={vi.fn()} onSkipForever={vi.fn()} />,
    );
    expect(screen.getByText("اكتشف موردين موثّقين")).toBeInTheDocument();

    fireEvent.click(screen.getByText("التالي"));
    expect(screen.getByText("اطلب عرض سعر بسهولة")).toBeInTheDocument();
  });

  it("calls onStartTour from the last slide's button", () => {
    const onStartTour = vi.fn();
    renderWithProviders(
      <WelcomeCarouselMobile role="client" slides={slides} onStartTour={onStartTour} onSnooze={vi.fn()} onSkipForever={vi.fn()} />,
    );
    fireEvent.click(screen.getByText("التالي"));
    fireEvent.click(screen.getByText("ابدأ الجولة"));
    expect(onStartTour).toHaveBeenCalledTimes(1);
  });

  it("advances on a reading-direction swipe (RTL: rightward drag → next)", () => {
    document.dir = "rtl";
    renderWithProviders(
      <WelcomeCarouselMobile role="client" slides={slides} onStartTour={vi.fn()} onSnooze={vi.fn()} onSkipForever={vi.fn()} />,
    );
    const region = screen.getByText("اكتشف موردين موثّقين").parentElement!;
    fireEvent.touchStart(region, { changedTouches: [{ clientX: 200 }] });
    fireEvent.touchEnd(region, { changedTouches: [{ clientX: 270 }] });
    expect(screen.getByText("اطلب عرض سعر بسهولة")).toBeInTheDocument();
  });

  it("ignores a drag shorter than the swipe threshold", () => {
    document.dir = "rtl";
    renderWithProviders(
      <WelcomeCarouselMobile role="client" slides={slides} onStartTour={vi.fn()} onSnooze={vi.fn()} onSkipForever={vi.fn()} />,
    );
    const region = screen.getByText("اكتشف موردين موثّقين").parentElement!;
    fireEvent.touchStart(region, { changedTouches: [{ clientX: 200 }] });
    fireEvent.touchEnd(region, { changedTouches: [{ clientX: 220 }] });
    expect(screen.getByText("اكتشف موردين موثّقين")).toBeInTheDocument();
  });

  it("exposes snooze and skip-forever controls", () => {
    const onSnooze = vi.fn();
    const onSkipForever = vi.fn();
    renderWithProviders(
      <WelcomeCarouselMobile role="client" slides={slides} onStartTour={vi.fn()} onSnooze={onSnooze} onSkipForever={onSkipForever} />,
    );
    fireEvent.click(screen.getByText("ذكّرني لاحقاً"));
    expect(onSnooze).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("تخطّي نهائياً"));
    expect(onSkipForever).toHaveBeenCalledTimes(1);
  });
});
