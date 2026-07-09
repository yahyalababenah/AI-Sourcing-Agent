/** Request a quote: a paper plane flies in along an arc while its dashed
 *  trail draws itself in behind — "sending" the request. */
export function PaperPlaneIllustration() {
  return (
    <svg className="wi-svg" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <path
        className="wi-trail"
        d="M22 96 Q44 92 58 74 T92 34"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeOpacity="0.35"
        strokeLinecap="round"
      />

      <g className="wi-plane">
        <path d="M96 24 L44 60 L68 66 Z" fill="white" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <path d="M96 24 L68 66 L60 96 Z" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <path d="M96 24 L68 66" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}
