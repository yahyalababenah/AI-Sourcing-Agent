import { createPortal } from "react-dom";

interface SpotlightProps {
  rect: DOMRect | null;
}

const PADDING = 6;

/**
 * Dims the page and cuts a highlight "hole" around the active tour target.
 *
 * Rendered via createPortal straight to document.body and positioned purely
 * from the target's getBoundingClientRect() — never from its place in the
 * DOM tree. This sidesteps the stacking-context trap from the plan review:
 * an ancestor with overflow:hidden or a transform would otherwise clip a
 * box-shadow-based spotlight if it were nested inside that ancestor.
 *
 * pointer-events: none so the spotlight never blocks interaction with the
 * highlighted element or the rest of the page underneath it.
 *
 * The ring pulses gently (onboardSpotlightPulse, index.css) so it reads as
 * a live, breathing highlight instead of a frozen overlay — respects
 * prefers-reduced-motion globally (see index.css's blanket media query).
 */
export function Spotlight({ rect }: SpotlightProps) {
  if (!rect) return null;

  return createPortal(
    <div
      aria-hidden
      data-testid="onboarding-spotlight"
      className="fixed z-[9998] rounded-xl pointer-events-none transition-[top,left,width,height] duration-200 motion-reduce:transition-none animate-[onboardSpotlightPulse_2.5s_ease-in-out_infinite]"
      style={{
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      }}
    />,
    document.body,
  );
}
