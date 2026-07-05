import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "../Skeleton";

describe("Skeleton", () => {
  it("renders a pulsing placeholder with default sizing", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("animate-pulse");
    expect(el).toHaveClass("h-4", "w-full", "rounded");
  });

  it("accepts a custom className for sizing/shape", () => {
    const { container } = render(<Skeleton className="aspect-[2/3] rounded-xl" />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("animate-pulse", "aspect-[2/3]", "rounded-xl");
  });
});
