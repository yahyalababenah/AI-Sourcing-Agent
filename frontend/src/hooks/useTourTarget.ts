import { useEffect, useState } from "react";

export type TourTargetStatus = "waiting" | "found" | "timeout";

export interface TourTargetResult {
  rect: DOMRect | null;
  status: TourTargetStatus;
}

/** How long to wait for an async-rendered target (e.g. a table behind an API
 *  call) before giving up — see plan §2.7-أ. */
const WAIT_TIMEOUT_MS = 3000;

/**
 * Resolves a live, scroll/resize-aware bounding rect for the element
 * matching `data-tour="<targetId>"`.
 *
 * Handles the async-DOM edge case from the plan review: some tour targets
 * (e.g. a table that only renders once an API call resolves) don't exist
 * yet when the step becomes active. A MutationObserver watches for the
 * element to appear; if it hasn't shown up within WAIT_TIMEOUT_MS, status
 * flips to "timeout" so the caller can skip the step instead of hanging.
 */
export function useTourTarget(targetId: string | null): TourTargetResult {
  const [result, setResult] = useState<TourTargetResult>({ rect: null, status: "waiting" });

  useEffect(() => {
    if (!targetId) {
      setResult({ rect: null, status: "waiting" });
      return;
    }

    let cancelled = false;
    let rafId: number | null = null;
    setResult({ rect: null, status: "waiting" });

    const selector = `[data-tour="${targetId}"]`;
    const findElement = () => document.querySelector<HTMLElement>(selector);

    const updateRect = () => {
      if (cancelled) return;
      const el = findElement();
      if (el) setResult({ rect: el.getBoundingClientRect(), status: "found" });
    };

    updateRect();

    const observer = new MutationObserver(updateRect);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    const handleScrollOrResize = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateRect();
      });
    };
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      setResult((prev) => (prev.status === "found" ? prev : { rect: null, status: "timeout" }));
    }, WAIT_TIMEOUT_MS);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      window.clearTimeout(timeoutId);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [targetId]);

  return result;
}
