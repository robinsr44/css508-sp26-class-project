import { useEffect, useState } from "react";

interface MoonPhaseProps {
  /** SunCalc-style phase in [0,1) (new→full→new); drives waxing vs waning and arc sweeps. */
  cycleFraction: number;
  /** Lit fraction from ephemeris, (1 + cos(inc)) / 2; drives terminator curvature. */
  illuminationFraction: number;
  /** Same instant as fraction; used so Full (>99% lit) matches the rounded UI percent. */
  illuminationPercent?: number;
  size?: number;
}

/**
 * Illumination-band shortcuts for the graphic (fraction k = lit portion of disk):
 * New moon <1.0%, Crescent up to ~48% lit, Quarter only 48% &lt; lit &lt; 52%,
 * Gibbous ~52–99%, Full >99.0%. (See `phaseDisplayName.ts` for exact UI bands.)
 * Crescent / quarter / gibbous use the shared terminator path; only the ends snap to solids.
 */
/** Solid dark disk only when lit fraction is strictly below 1.0%. */
const NEW_MOON_LT_FRACTION = 0.01;

/** Lit percent above this ⇒ solid light disk + “Full” label override (>99.0%). */
const FULL_MOON_MIN_PERCENT_STRICT = 99;

/** When percent is absent: fraction above this ⇒ full disk (>99.0%). */
const FULL_MOON_EXCLUSIVE_ABOVE_LIT = 0.99;

/** True when illumination is in the New band (<1.0% lit; solid dark disk + “New” label override). */
export function illuminationIndicatesNewMoon(
  illuminationFraction: number,
  illuminationPercent?: number,
): boolean {
  const k = Number(illuminationFraction);
  if (illuminationPercent !== undefined && Number.isFinite(illuminationPercent) && illuminationPercent < 1) {
    return true;
  }
  return Number.isFinite(k) && k < NEW_MOON_LT_FRACTION;
}

/** True when illumination is in the Full band (solid light disk + “Full” label override). */
export function illuminationIndicatesFullMoon(
  illuminationFraction: number,
  illuminationPercent?: number,
): boolean {
  const k = Number(illuminationFraction);
  if (illuminationPercent !== undefined && Number.isFinite(illuminationPercent) && illuminationPercent > FULL_MOON_MIN_PERCENT_STRICT) {
    return true;
  }
  return Number.isFinite(k) && k > FULL_MOON_EXCLUSIVE_ABOVE_LIT;
}

/**
 * Waxing-side limb path (lit limb grows on the right). Same ellipse rx = r·|2k−1| as before.
 *
 * For waning cycles we reuse this path inside `scale(-1,1)` about the disk center — the old
 * dedicated waning arc commands traced the complementary wedge (thin lit on the wrong side),
 * which looked like a crescent when the moon was almost full.
 */
function waxingLitPath(cx: number, cy: number, r: number, k: number): string | null {
  const absRx = r * Math.abs(2 * k - 1);
  const sweepEllipse = k < 0.5 ? 0 : 1;
  return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${absRx} ${r} 0 1 ${sweepEllipse} ${cx} ${cy - r} Z`;
}

export default function MoonPhase({
  cycleFraction,
  illuminationFraction,
  illuminationPercent,
  size = 80,
}: MoonPhaseProps) {
  const r = (size - 6) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    setEntered(false);
    const t = window.setTimeout(() => setEntered(true), 40);
    return () => window.clearTimeout(t);
  }, [cycleFraction, illuminationFraction, illuminationPercent]);

  const k = Number(illuminationFraction);
  const solidFull = illuminationIndicatesFullMoon(k, illuminationPercent);
  const litPath =
    !Number.isFinite(k) || solidFull || k < NEW_MOON_LT_FRACTION ? null : waxingLitPath(cx, cy, r, k);
  const waning = cycleFraction >= 0.5;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className="moon-phase-svg"
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? "scale(1)" : "scale(0.8)",
        transition: "opacity 0.75s ease, transform 0.75s ease",
      }}
    >
      <circle cx={cx} cy={cy} r={r} className="moon-disk-bg" />
      {solidFull ? (
        <circle cx={cx} cy={cy} r={r} className="moon-lit-face" />
      ) : litPath ? (
        waning ? (
          <g transform={`translate(${cx} ${cy}) scale(-1 1) translate(${-cx} ${-cy})`}>
            <path d={litPath} className="moon-lit-face" />
          </g>
        ) : (
          <path d={litPath} className="moon-lit-face" />
        )
      ) : null}
    </svg>
  );
}
