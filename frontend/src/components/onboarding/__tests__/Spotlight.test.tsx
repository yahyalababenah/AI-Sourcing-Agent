import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Spotlight } from "../Spotlight";

function makeRect(overrides: Partial<DOMRect> = {}): DOMRect {
  return {
    top: 10,
    left: 20,
    width: 100,
    height: 40,
    right: 120,
    bottom: 50,
    x: 20,
    y: 10,
    toJSON() {},
    ...overrides,
  } as DOMRect;
}

describe("Spotlight", () => {
  it("renders nothing when rect is null", () => {
    render(<Spotlight rect={null} />);
    expect(screen.queryByTestId("onboarding-spotlight")).not.toBeInTheDocument();
  });

  it("portals a fixed, non-interactive highlight into document.body positioned from the rect", () => {
    render(<Spotlight rect={makeRect({ top: 10, left: 20, width: 100, height: 40 })} />);
    const spotlight = screen.getByTestId("onboarding-spotlight");

    expect(spotlight.parentElement).toBe(document.body);
    expect(spotlight).toHaveClass("fixed", "pointer-events-none");
    expect(spotlight.style.top).toBe("4px"); // 10 - PADDING(6)
    expect(spotlight.style.left).toBe("14px"); // 20 - PADDING(6)
    expect(spotlight.style.width).toBe("112px"); // 100 + PADDING*2
    expect(spotlight.style.height).toBe("52px"); // 40 + PADDING*2
  });

  it("is aria-hidden since it's purely decorative", () => {
    render(<Spotlight rect={makeRect()} />);
    expect(screen.getByTestId("onboarding-spotlight")).toHaveAttribute("aria-hidden", "true");
  });
});
