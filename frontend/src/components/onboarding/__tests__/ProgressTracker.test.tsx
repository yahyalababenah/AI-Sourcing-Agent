import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressTracker } from "../ProgressTracker";
import "@/lib/i18n";

describe("ProgressTracker", () => {
  it("starts at ~25-30% for a fresh tour thanks to the two phantom steps", () => {
    // 0 real steps done out of 6 real steps -> (0+2)/(6+2) = 25%
    render(<ProgressTracker completedCount={0} totalCount={6} role="agent" />);
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("أنجزت 2 من 8")).toBeInTheDocument();
  });

  it("reaches 100% only once every real step is completed", () => {
    render(<ProgressTracker completedCount={6} totalCount={6} role="agent" />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("shows the celebration message once past the threshold but not at 100%", () => {
    const { rerender } = render(<ProgressTracker completedCount={0} totalCount={6} role="agent" />);
    expect(screen.queryByText("تبقّى القليل 🎉")).not.toBeInTheDocument();

    // (4+2)/(6+2) = 75% -> past the 60% threshold
    rerender(<ProgressTracker completedCount={4} totalCount={6} role="agent" />);
    expect(screen.getByText("تبقّى القليل 🎉")).toBeInTheDocument();

    rerender(<ProgressTracker completedCount={6} totalCount={6} role="agent" />);
    expect(screen.queryByText("تبقّى القليل 🎉")).not.toBeInTheDocument();
  });

  it("uses the importer accent for the client role", () => {
    const { container } = render(<ProgressTracker completedCount={0} totalCount={6} role="client" />);
    expect(container.querySelector(".bg-importer-500")).toBeInTheDocument();
    expect(container.querySelector(".text-importer-600")).toBeInTheDocument();
  });

  it("sets the bar width to the computed percentage", () => {
    const { container } = render(<ProgressTracker completedCount={2} totalCount={6} role="agent" />);
    // (2+2)/(6+2) = 50%
    const bar = container.querySelector(".rounded-full.h-full") as HTMLElement;
    expect(bar.style.width).toBe("50%");
  });
});
