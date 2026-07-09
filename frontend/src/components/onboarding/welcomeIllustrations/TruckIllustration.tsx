/** Shipment truck: speed lines streak past as the truck drives in from the
 *  left with its wheels spinning, then it settles. All one-shot — nothing
 *  loops after it arrives. */
function Wheel({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g className="wi-wheel" style={{ transform: "translateZ(0)" }}>
      <circle cx={cx} cy={cy} r="9" fill="white" stroke="currentColor" strokeWidth="3" />
      <circle cx={cx} cy={cy} r="3" fill="currentColor" />
      {/* short radial mark (kept inside the tyre so the wheel's bbox stays
          centred → rotation pivots on the hub) makes the spin visible */}
      <line x1={cx} y1={cy} x2={cx} y2={cy - 6} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

export function TruckIllustration() {
  return (
    <svg className="wi-svg" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      {/* speed lines (independent of the truck group so they streak past it) */}
      <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.35">
        <line className="wi-speed" x1="10" y1="52" x2="22" y2="52" />
        <line className="wi-speed wi-speed-2" x1="6" y1="64" x2="20" y2="64" />
        <line className="wi-speed wi-speed-3" x1="12" y1="76" x2="24" y2="76" />
      </g>

      <g className="wi-truck">
        <rect x="18" y="44" width="52" height="34" rx="5" fill="white" stroke="currentColor" strokeWidth="3" />
        <path
          d="M70 78 V58 Q70 54 74 54 H88 L98 66 V78 Z"
          fill="currentColor"
          fillOpacity="0.12"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <rect x="86" y="58" width="9" height="8" rx="1.5" fill="white" stroke="currentColor" strokeWidth="2" />
        <Wheel cx={34} cy={84} />
        <Wheel cx={84} cy={84} />
      </g>

      {/* road */}
      <line x1="14" y1="98" x2="106" y2="98" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.25" />
    </svg>
  );
}
