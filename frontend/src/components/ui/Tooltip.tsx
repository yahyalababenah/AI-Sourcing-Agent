import { useState, useRef, useLayoutEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  /** The content to display inside the tooltip popup. */
  content: ReactNode;
  /** The trigger element that shows the tooltip on hover. */
  children: ReactNode;
  /** Optional class name for the trigger wrapper. */
  className?: string;
  /**
   * Delay in milliseconds before showing the tooltip.
   * @default 300
   */
  delay?: number;
}

interface Position {
  top: number;
  left: number;
}

type Placement = "top" | "bottom";

/**
 * Lightweight tooltip component built with pure TailwindCSS + React.
 *
 * Features:
 * - Shows on hover with a configurable delay (default 300ms)
 * - Positions above the trigger by default, falls back to below if insufficient space
 * - Uses `position: fixed` with manual `getBoundingClientRect()` coordinate calculation
 * - Detects RTL via `document.dir` and adjusts positioning accordingly
 * - Includes a CSS arrow pointing toward the trigger
 * - Fade/scale animation via CSS transitions
 * - Prevents viewport overflow on all edges
 *
 * @example
 * ```tsx
 * <Tooltip content="شرح المصطلح">
 *   <span>CBM</span>
 * </Tooltip>
 * ```
 */
export function Tooltip({
  content,
  children,
  className,
  delay = 300,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isPositioned, setIsPositioned] = useState(false);
  const [position, setPosition] = useState<Position>({ top: 0, left: 0 });
  const [placement, setPlacement] = useState<Placement>("top");

  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  /**
   * Calculate the tooltip position based on the trigger element's bounding
   * rect. Handles RTL by inverting the horizontal anchor point.
   */
  const calculatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;

    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const gap = 8;
    const arrowSize = 6;
    const viewportPadding = 4;

    // Determine if the document is in RTL mode
    const isRTL = document.dir === "rtl";

    // Try placing above the trigger first
    let top = triggerRect.top - tooltipRect.height - gap - arrowSize;
    let place: Placement = "top";

    // If there's not enough room above, place below
    if (top < viewportPadding) {
      top = triggerRect.bottom + gap + arrowSize;
      place = "bottom";
    }

    // Center horizontally relative to the trigger
    let left: number;

    if (isRTL) {
      // In RTL, align the right edge of the tooltip with the center of the trigger
      left = triggerRect.right - tooltipRect.width / 2;
    } else {
      // In LTR, align the left edge of the tooltip with the center of the trigger
      left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    }

    // Keep the tooltip within viewport bounds
    if (left < viewportPadding) {
      left = viewportPadding;
    }
    if (left + tooltipRect.width > window.innerWidth - viewportPadding) {
      left = window.innerWidth - tooltipRect.width - viewportPadding;
    }

    setPosition({ top, left });
    setPlacement(place);
    setIsPositioned(true);
  }, []);

  /** Show the tooltip after the configured delay. */
  const showWithDelay = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [delay]);

  /** Hide the tooltip immediately. */
  const hide = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(false);
    setIsPositioned(false);
  }, []);

  // Measure and position the tooltip once it's rendered in the DOM
  useLayoutEffect(() => {
    if (isVisible) {
      calculatePosition();
    }
  }, [isVisible, calculatePosition]);

  // Cleanup timeout on unmount
  useLayoutEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <span
      ref={triggerRef}
      className={cn("inline-flex", className)}
      onMouseEnter={showWithDelay}
      onMouseLeave={hide}
    >
      {children}

      {/* Tooltip popup — positioned with fixed coordinates */}
      {isVisible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          style={{
            position: "fixed",
            top: position.top,
            left: position.left,
          }}
          className={cn(
            "z-50 max-w-xs rounded-md bg-slate-800 px-3 py-2 text-sm leading-relaxed text-white shadow-lg",
            "transition-all duration-150 ease-out",
            isPositioned
              ? "translate-y-0 scale-100 opacity-100"
              : "translate-y-1 scale-95 opacity-0"
          )}
          onMouseEnter={showWithDelay}
          onMouseLeave={hide}
        >
          {content}

          {/* Arrow — CSS square rotated 45°, positioned at the edge toward the trigger */}
          <div
            className={cn(
              "absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-slate-800",
              placement === "top" ? "-bottom-1" : "-top-1"
            )}
            aria-hidden="true"
          />
        </div>
      )}
    </span>
  );
}
