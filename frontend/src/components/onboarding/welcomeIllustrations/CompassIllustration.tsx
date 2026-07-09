/** Discover verified suppliers: the compass needle spins, decelerates, and
 *  settles on a heading — "finding direction" toward trusted factories. */
export function CompassIllustration() {
  return (
    <svg className="wi-svg" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <g className="wi-compass-ring">
        <circle cx="60" cy="60" r="34" fill="white" stroke="currentColor" strokeWidth="3" />
        <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.5">
          <line x1="60" y1="30" x2="60" y2="36" />
          <line x1="60" y1="84" x2="60" y2="90" />
          <line x1="30" y1="60" x2="36" y2="60" />
          <line x1="84" y1="60" x2="90" y2="60" />
        </g>
      </g>

      <g className="wi-needle">
        <path d="M60 34 L66 60 L54 60 Z" fill="currentColor" />
        <path d="M60 86 L54 60 L66 60 Z" fill="currentColor" fillOpacity="0.28" />
      </g>

      <circle cx="60" cy="60" r="3.5" fill="white" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}
