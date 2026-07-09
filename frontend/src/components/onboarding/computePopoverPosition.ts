interface PopoverPosition {
  top: number;
  left: number;
}

const MARGIN = 12;

/**
 * Places the desktop popover near the target rect, preferring below it and
 * falling back above when there isn't room, then clamps both axes to stay
 * fully inside the viewport. Pure pixel math off getBoundingClientRect() —
 * no dependency on DOM ancestry, so it works regardless of dir="rtl"/"ltr"
 * or any overflow/transform ancestor the target happens to sit inside
 * (see plan §2.7-c).
 */
export function computePopoverPosition(
  rect: DOMRect,
  popoverWidth: number,
  popoverHeight: number,
  viewportWidth: number = window.innerWidth,
  viewportHeight: number = window.innerHeight,
): PopoverPosition {
  let top = rect.bottom + MARGIN;
  if (top + popoverHeight > viewportHeight - MARGIN) {
    top = rect.top - popoverHeight - MARGIN;
  }
  top = Math.max(MARGIN, Math.min(top, viewportHeight - popoverHeight - MARGIN));

  let left = rect.left;
  if (left + popoverWidth > viewportWidth - MARGIN) {
    left = viewportWidth - popoverWidth - MARGIN;
  }
  left = Math.max(MARGIN, left);

  return { top, left };
}
