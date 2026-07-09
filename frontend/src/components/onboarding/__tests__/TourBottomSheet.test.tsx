import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TourBottomSheet } from "../TourBottomSheet";
import "@/lib/i18n";

const baseProps = {
  role: "client" as const,
  rect: null,
  targetStatus: "found" as const,
  title: "عنوان الخطوة",
  description: "شرح الخطوة",
  onNext: vi.fn(),
  onBack: vi.fn(),
  onSkipStep: vi.fn(),
  onSnooze: vi.fn(),
  onFinish: vi.fn(),
  isFirst: false,
  isLast: false,
};

describe("TourBottomSheet", () => {
  it("renders nothing when the target timed out", () => {
    render(<TourBottomSheet {...baseProps} targetStatus="timeout" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a skeleton while the target resolves", () => {
    render(<TourBottomSheet {...baseProps} targetStatus="waiting" />);
    expect(screen.getByText("جارٍ التحضير...")).toBeInTheDocument();
  });

  it("renders title/description and calls onCta", () => {
    const onCta = vi.fn();
    render(<TourBottomSheet {...baseProps} ctaLabel="جرّبها الآن" onCta={onCta} />);
    expect(screen.getByText("عنوان الخطوة")).toBeInTheDocument();
    screen.getByText("جرّبها الآن").click();
    expect(onCta).toHaveBeenCalledTimes(1);
  });

  it("calls onFinish on the last step's primary button", () => {
    const onFinish = vi.fn();
    render(<TourBottomSheet {...baseProps} isLast onFinish={onFinish} />);
    screen.getByText("إنهاء الجولة").click();
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("docks to the bottom and is hidden on desktop", () => {
    render(<TourBottomSheet {...baseProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("bottom-0", "lg:hidden");
  });
});
