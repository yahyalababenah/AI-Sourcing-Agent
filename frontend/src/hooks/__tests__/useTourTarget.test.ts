import { describe, expect, it, vi, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useTourTarget } from "../useTourTarget";

function appendTarget(id: string, rect: Partial<DOMRect> = {}) {
  const el = document.createElement("div");
  el.setAttribute("data-tour", id);
  el.getBoundingClientRect = () =>
    ({ top: 0, left: 0, width: 100, height: 40, right: 100, bottom: 40, x: 0, y: 0, toJSON() {} , ...rect } as DOMRect);
  document.body.appendChild(el);
  return el;
}

describe("useTourTarget", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("finds an element that already exists at mount", async () => {
    appendTarget("agent-nav-intro", { top: 10, left: 20, width: 80, height: 30 });
    const { result } = renderHook(() => useTourTarget("agent-nav-intro"));

    await waitFor(() => expect(result.current.status).toBe("found"));
    expect(result.current.rect?.top).toBe(10);
    expect(result.current.rect?.left).toBe(20);
  });

  it("returns status=waiting immediately when the target does not exist yet", () => {
    const { result } = renderHook(() => useTourTarget("does-not-exist"));
    expect(result.current.status).toBe("waiting");
    expect(result.current.rect).toBeNull();
  });

  it("detects an element appended to the DOM later via MutationObserver", async () => {
    const { result } = renderHook(() => useTourTarget("late-target"));
    expect(result.current.status).toBe("waiting");

    act(() => {
      appendTarget("late-target");
    });

    await waitFor(() => expect(result.current.status).toBe("found"));
  });

  it("times out after ~3s if the target never appears", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTourTarget("never-appears"));
    expect(result.current.status).toBe("waiting");

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.status).toBe("timeout");
  });

  it("does not time out if the target was found before the deadline", () => {
    vi.useFakeTimers();
    appendTarget("found-early");
    const { result } = renderHook(() => useTourTarget("found-early"));
    expect(result.current.status).toBe("found");

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.status).toBe("found");
  });

  it("prefers a visible duplicate target over a hidden one with the same id (desktop/mobile dual-render pattern)", async () => {
    // Sidebar renders twice — once hidden via `hidden lg:flex` on desktop
    // breakpoints, once inside MobileDrawer — both carrying the same
    // data-tour id. The hidden copy must never win.
    const hidden = appendTarget("dup-target", { top: 999, left: 999 });
    Object.defineProperty(hidden, "offsetWidth", { value: 0, configurable: true });
    Object.defineProperty(hidden, "offsetHeight", { value: 0, configurable: true });

    const visible = appendTarget("dup-target", { top: 5, left: 5 });
    Object.defineProperty(visible, "offsetWidth", { value: 100, configurable: true });
    Object.defineProperty(visible, "offsetHeight", { value: 40, configurable: true });

    const { result } = renderHook(() => useTourTarget("dup-target"));
    await waitFor(() => expect(result.current.status).toBe("found"));
    expect(result.current.rect?.top).toBe(5);
  });

  it("resets to waiting when targetId changes to null", () => {
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useTourTarget(id), {
      initialProps: { id: "some-target" as string | null },
    });
    rerender({ id: null });
    expect(result.current.status).toBe("waiting");
    expect(result.current.rect).toBeNull();
  });
});
