/** Landed-cost calculator: a scan line sweeps the screen, the computed
 *  total lands, and the "=" key lights up. Monochrome line-art tinted by
 *  the stage's currentColor. */
export function CalculatorIllustration() {
  const keys: Array<[number, number]> = [];
  for (const y of [52, 64, 76]) for (const x of [46, 57, 68]) keys.push([x, y]);

  return (
    <svg className="wi-svg" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <rect x="38" y="16" width="44" height="88" rx="11" fill="white" stroke="currentColor" strokeWidth="3" />
      <rect x="46" y="26" width="28" height="16" rx="3" fill="currentColor" fillOpacity="0.12" />

      <g className="wi-calc-total">
        <rect x="52" y="31" width="5" height="6" rx="1" fill="currentColor" />
        <rect x="59" y="31" width="5" height="6" rx="1" fill="currentColor" />
        <rect x="66" y="31" width="3" height="6" rx="1" fill="currentColor" />
      </g>

      <rect className="wi-calc-scan" x="47" y="28" width="3" height="12" rx="1.5" fill="currentColor" fillOpacity="0.55" />

      {keys.map(([x, y], i) => {
        const isEq = x === 68 && y === 76;
        if (isEq) return null;
        return <rect key={i} x={x} y={y} width="8" height="8" rx="2" fill="currentColor" fillOpacity="0.18" />;
      })}
      <rect className="wi-calc-eq" x="68" y="76" width="8" height="8" rx="2" fill="currentColor" />
    </svg>
  );
}
