/** Turn your catalog into products: the box lid lifts ajar and three
 *  extracted product cards rise out and float above it, staggered. */
function ProductCard({ x, className }: { x: number; className: string }) {
  return (
    <g className={className}>
      <rect x={x} y="38" width="14" height="12" rx="2.5" fill="white" stroke="currentColor" strokeWidth="2.5" />
      <circle cx={x + 4.5} cy="42.5" r="1.6" fill="currentColor" />
      <line x1={x + 8} y1="42" x2={x + 11} y2="42" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1={x + 8} y1="45.5" x2={x + 10.5} y2="45.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.5" />
    </g>
  );
}

export function PackageIllustration() {
  return (
    <svg className="wi-svg" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      {/* box body */}
      <rect x="36" y="58" width="48" height="42" rx="4" fill="white" stroke="currentColor" strokeWidth="3" />
      <line x1="60" y1="58" x2="60" y2="100" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />

      {/* rising extracted products (behind the lid so they read as emerging) */}
      <ProductCard x={42} className="wi-product wi-product-1" />
      <ProductCard x={53} className="wi-product wi-product-2" />
      <ProductCard x={64} className="wi-product wi-product-3" />

      {/* lid, lifts ajar */}
      <g className="wi-lid">
        <rect x="34" y="50" width="52" height="12" rx="3" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="3" />
      </g>
    </svg>
  );
}
