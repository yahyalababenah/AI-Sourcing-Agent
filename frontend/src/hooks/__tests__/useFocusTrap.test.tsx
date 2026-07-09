import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { useFocusTrap } from "../useFocusTrap";

function TrapHarness({ active }: { active: boolean }) {
  const ref = useFocusTrap<HTMLDivElement>(active);
  return (
    <div ref={ref}>
      <button>first</button>
      <button>middle</button>
      <button>last</button>
    </div>
  );
}

describe("useFocusTrap", () => {
  it("moves focus to the first focusable element when activated", () => {
    const { getByText } = render(<TrapHarness active />);
    expect(document.activeElement).toBe(getByText("first"));
  });

  it("does nothing when inactive", () => {
    render(<TrapHarness active={false} />);
    expect(document.activeElement?.tagName).not.toBe("BUTTON");
  });

  it("wraps Tab from the last element back to the first", () => {
    const { getByText } = render(<TrapHarness active />);
    const last = getByText("last");
    last.focus();

    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    fireEvent(last, event);

    expect(document.activeElement).toBe(getByText("first"));
  });

  it("wraps Shift+Tab from the first element back to the last", () => {
    const { getByText } = render(<TrapHarness active />);
    const first = getByText("first");
    first.focus();

    const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true });
    fireEvent(first, event);

    expect(document.activeElement).toBe(getByText("last"));
  });

  it("does not interfere with Tab between middle elements", () => {
    const { getByText } = render(<TrapHarness active />);
    const middle = getByText("middle");
    middle.focus();

    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    const notPrevented = fireEvent(middle, event);

    // Only boundary Tabs are intercepted — the browser's default tab order
    // handles the middle element, so preventDefault should not have been called.
    expect(notPrevented).toBe(true);
  });
});
