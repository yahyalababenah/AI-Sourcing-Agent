import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCarouselNav } from "../useCarouselNav";

describe("useCarouselNav", () => {
  it("starts at index 0 and reports first/last correctly", () => {
    const { result } = renderHook(() => useCarouselNav(3));
    expect(result.current.index).toBe(0);
    expect(result.current.isFirst).toBe(true);
    expect(result.current.isLast).toBe(false);
  });

  it("advances with next() and clamps at the last index", () => {
    const { result } = renderHook(() => useCarouselNav(2));
    act(() => result.current.next());
    expect(result.current.index).toBe(1);
    expect(result.current.isLast).toBe(true);
    act(() => result.current.next());
    expect(result.current.index).toBe(1);
  });

  it("goes back with back() and clamps at 0", () => {
    const { result } = renderHook(() => useCarouselNav(3));
    act(() => result.current.goTo(2));
    act(() => result.current.back());
    expect(result.current.index).toBe(1);
    act(() => result.current.back());
    act(() => result.current.back());
    expect(result.current.index).toBe(0);
  });

  it("goTo clamps out-of-range indices", () => {
    const { result } = renderHook(() => useCarouselNav(3));
    act(() => result.current.goTo(99));
    expect(result.current.index).toBe(2);
    act(() => result.current.goTo(-5));
    expect(result.current.index).toBe(0);
  });
});
