import type { MoonApiResponse } from "./api";
import { illuminationIndicatesFullMoon, illuminationIndicatesNewMoon } from "./MoonPhase";

/** Lit percent for banding; prefer JSON `illumination.percent`, else `fraction * 100`. */
function effectiveLitPercent(fraction: number, percent: number | undefined): number | null {
  if (percent !== undefined && Number.isFinite(percent)) {
    return percent;
  }
  if (Number.isFinite(fraction)) {
    return fraction * 100;
  }
  return null;
}

/**
 * UI phase name from illumination bands and wax/wane (`cycle_fraction` &lt; 0.5 ⇒ waxing).
 * Eighth-based API names are ignored so labels match lit fraction (e.g. First / Third Quarter
 * only when 48% &lt; lit &lt; 52%).
 */
export function phaseDisplayName(data: MoonApiResponse): string {
  if (typeof data.illumination.fraction !== "number") {
    return data.phase.name;
  }

  const { fraction, percent } = data.illumination;

  if (illuminationIndicatesNewMoon(fraction, percent)) {
    return "New";
  }
  if (illuminationIndicatesFullMoon(fraction, percent)) {
    return "Full";
  }

  const p = effectiveLitPercent(fraction, percent);
  if (p === null) {
    return data.phase.name;
  }

  const cfRaw = data.phase.cycle_fraction;
  const cf = typeof cfRaw === "number" && Number.isFinite(cfRaw) ? cfRaw : 0;
  const waxing = cf < 0.5;

  if (p > 48 && p < 52) {
    return waxing ? "First Quarter" : "Third Quarter";
  }
  if (p <= 48) {
    return waxing ? "Waxing Crescent" : "Waning Crescent";
  }
  if (p >= 52) {
    return waxing ? "Waxing Gibbous" : "Waning Gibbous";
  }

  return data.phase.name;
}
