import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TourPopover } from "../TourPopover";
import "@/lib/i18n";

function rect(): DOMRect {
  return { top: 100, left: 100, width: 80, height: 30, right: 180, bottom: 130, x: 100, y: 100, toJSON() {} } as DOMRect;
}

const baseProps = {
  role: "agent" as const,
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

describe("TourPopover", () => {
  it("renders nothing when rect is null", () => {
    render(<TourPopover {...baseProps} rect={null} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nothing when the target timed out", () => {
    render(<TourPopover {...baseProps} rect={rect()} targetStatus="timeout" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a skeleton while the target is still resolving", () => {
    render(<TourPopover {...baseProps} rect={rect()} targetStatus="waiting" />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("جارٍ التحضير...")).toBeInTheDocument();
    expect(screen.queryByText("عنوان الخطوة")).not.toBeInTheDocument();
  });

  it("shows title and description — the user is already on the real feature page, no CTA needed", () => {
    render(<TourPopover {...baseProps} rect={rect()} />);
    expect(screen.getByText("عنوان الخطوة")).toBeInTheDocument();
    expect(screen.getByText("شرح الخطوة")).toBeInTheDocument();
  });

  it("shows 'إنهاء الجولة' instead of 'التالي' on the last step and calls onFinish", () => {
    const onFinish = vi.fn();
    render(<TourPopover {...baseProps} rect={rect()} isLast onFinish={onFinish} />);
    const finishButton = screen.getByText("إنهاء الجولة");
    finishButton.click();
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("disables the back button on the first step", () => {
    render(<TourPopover {...baseProps} rect={rect()} isFirst />);
    expect(screen.getByText("السابق").closest("button")).toBeDisabled();
  });

  it("portals into document.body", () => {
    const { container } = render(<TourPopover {...baseProps} rect={rect()} />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(screen.getByRole("dialog").parentElement).toBe(document.body);
  });
});
