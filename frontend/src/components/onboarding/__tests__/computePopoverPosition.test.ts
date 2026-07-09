import { describe, expect, it } from "vitest";
import { computePopoverPosition } from "../computePopoverPosition";

function rect(overrides: Partial<DOMRect> = {}): DOMRect {
  return { top: 100, left: 100, width: 80, height: 30, right: 180, bottom: 130, x: 100, y: 100, toJSON() {}, ...overrides } as DOMRect;
}

describe("computePopoverPosition", () => {
  it("places the popover below the target when there is room", () => {
    const pos = computePopoverPosition(rect({ bottom: 130 }), 320, 220, 1200, 800);
    expect(pos.top).toBe(130 + 12);
  });

  it("flips above the target when there isn't room below", () => {
    const pos = computePopoverPosition(rect({ top: 700, bottom: 730 }), 320, 220, 1200, 800);
    expect(pos.top).toBeLessThan(700);
  });

  it("clamps left so the popover never overflows the right edge of the viewport", () => {
    const pos = computePopoverPosition(rect({ left: 1150 }), 320, 220, 1200, 800);
    expect(pos.left + 320).toBeLessThanOrEqual(1200);
  });

  it("clamps left so the popover never goes past the left edge", () => {
    const pos = computePopoverPosition(rect({ left: -50 }), 320, 220, 1200, 800);
    expect(pos.left).toBeGreaterThanOrEqual(12);
  });

  it("clamps top within the viewport even for very short viewports", () => {
    const pos = computePopoverPosition(rect({ top: 10, bottom: 40 }), 320, 220, 1200, 300);
    expect(pos.top).toBeGreaterThanOrEqual(12);
    expect(pos.top + 220).toBeLessThanOrEqual(300 + 12); // allow margin tolerance
  });
});
