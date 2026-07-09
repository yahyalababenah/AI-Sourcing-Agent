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
 * The ring settles in once (onboardSpotlightIn, index.css) — a soft halo
 * pulls into a crisp ring on arrival, then holds static. No looping pulse:
 * a continuous throb is attention-seeking and ages badly. Position changes
 * between steps glide via the top/left/width/height transition. Respects
 * prefers-reduced-motion globally (see index.css's blanket media query).
 */
export function Spotlight({ rect }: SpotlightProps) {
  if (!rect) return null;

  return createPortal(
    <div
      aria-hidden
      data-testid="onboarding-spotlight"
      className="fixed z-[9998] rounded-xl pointer-events-none transition-[top,left,width,height] duration-300 ease-out motion-reduce:transition-none animate-[onboardSpotlightIn_360ms_ease-out_both]"
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
