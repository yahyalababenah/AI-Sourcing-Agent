import { useState, useEffect } from "react";

/**
 * Tracks whether a CSS media query currently matches. Used to pick between
 * a screen's separate desktop/mobile file per CLAUDE.md's mandatory
 * two-file pattern — never to toggle layout within a single file via
 * hidden/lg:block classes.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
