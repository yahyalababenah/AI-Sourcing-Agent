import { useState } from "react";

/** Index-based navigation for a fixed-length slide/step sequence. */
export function useCarouselNav(total: number) {
  const [index, setIndex] = useState(0);

  const isFirst = index === 0;
  const isLast = index >= total - 1;

  const next = () => setIndex((i) => Math.min(i + 1, total - 1));
  const back = () => setIndex((i) => Math.max(i - 1, 0));
  const goTo = (i: number) => setIndex(Math.max(0, Math.min(i, total - 1)));

  return { index, isFirst, isLast, next, back, goTo };
}
