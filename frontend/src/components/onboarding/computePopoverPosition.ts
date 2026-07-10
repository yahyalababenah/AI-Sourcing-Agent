interface PopoverPosition {
  top: number;
  left: number;
}

const MARGIN = 12;

/** TopBar (components/layout/TopBar.tsx) is a fixed `h-14` (56px) header on
 *  every layout. A target that starts right below it (e.g. the full-height
 *  sidebar nav) pushes the "prefer above" fallback into negative territory,
 *  which a plain MARGIN clamp then pins to y=12 — on top of the TopBar's
 *  avatar/notification icons instead of clear of them. Clamp the top edge
 *  to this safe area instead of the bare margin. */
const TOPBAR_SAFE_TOP = 68;

/**
 * Places the desktop popover near the target rect, preferring below it and
 * falling back above when there isn't room, then clamps both axes to stay
 * fully inside the viewport (and clear of the TopBar). Pure pixel math off
 * getBoundingClientRect() — no dependency on DOM ancestry, so it works
 * regardless of dir="rtl"/"ltr" or any overflow/transform ancestor the
 * target happens to sit inside (see plan §2.7-c).
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
  top = Math.max(TOPBAR_SAFE_TOP, Math.min(top, viewportHeight - popoverHeight - MARGIN));

  let left = rect.left;
  if (left + popoverWidth > viewportWidth - MARGIN) {
    left = viewportWidth - popoverWidth - MARGIN;
  }
  left = Math.max(MARGIN, left);

  return { top, left };
}
