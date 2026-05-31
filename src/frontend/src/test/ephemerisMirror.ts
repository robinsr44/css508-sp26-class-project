/**
 * Mirrors `moon_ephemeris.cpp` (SunCalc-derived; see THIRD_PARTY_NOTICES.md) so frontend tests
 * can assert against the same low-precision ephemeris as the C++ backend without starting
 * the HTTP server.
 */

import type { MoonApiResponse, SunApiResponse, VisibilityWindowUtc } from "../api";
import {
  getPrimaryTimeZone,
  localCivilDayUtcBounds,
  utcCalendarDayBounds,
  utcWallClockToLocal,
} from "../locationTime";

const PI = Math.PI;
const RAD = PI / 180;
const E = RAD * 23.4397;
const J2000 = 2451545.0;
const J1970 = 2440588.0;

function toJulianFromUnix(unixSec: number): number {
  return unixSec / 86400 - 0.5 + J1970;
}

export function jdFromUtcYmdHms(y: number, m: number, d: number, hh: number, mm: number, ss = 0): number {
  const unixMs = Date.UTC(y, m - 1, d, hh, mm, ss);
  return toJulianFromUnix(unixMs / 1000);
}

function toDaysFromJd(jd: number): number {
  return jd - J2000;
}

function unixSecondsFromJulianDate(jd: number): number {
  return (jd + 0.5 - J1970) * 86400;
}

/** Matches `moon::iso8601_utc_from_jd` (gmtime of floor(sec + 0.5)). */
export function iso8601UtcFromJd(jd: number): string {
  const sec = unixSecondsFromJulianDate(jd);
  const t = Math.floor(sec + 0.5);
  const d = new Date(t * 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;
}

function rightAscension(l: number, b: number): number {
  return Math.atan2(Math.sin(l) * Math.cos(E) - Math.tan(b) * Math.sin(E), Math.cos(l));
}

function declination(l: number, b: number): number {
  return Math.asin(Math.sin(b) * Math.cos(E) + Math.cos(b) * Math.sin(E) * Math.sin(l));
}

function azimuth(H: number, phi: number, dec: number): number {
  return Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
}

function altitude(H: number, phi: number, dec: number): number {
  return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
}

function siderealTime(d: number, lw: number): number {
  return RAD * (280.16 + 360.9856235 * d) - lw;
}

function astroRefraction(h: number): number {
  let x = h;
  if (x < 0) x = 0;
  return 0.0002967 / Math.tan(x + 0.00312536 / (x + 0.08901179));
}

function solarMeanAnomaly(d: number): number {
  return RAD * (357.5291 + 0.98560028 * d);
}

function eclipticLongitude(M: number): number {
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const P = RAD * 102.9372;
  return M + C + P + PI;
}

interface SunCoords {
  ra: number;
  dec: number;
}

function sunCoords(d: number): SunCoords {
  const M = solarMeanAnomaly(d);
  const L = eclipticLongitude(M);
  return { ra: rightAscension(L, 0), dec: declination(L, 0) };
}

interface MoonCoords {
  ra: number;
  dec: number;
  dist: number;
}

function moonCoords(d: number): MoonCoords {
  const L = RAD * (218.316 + 13.176396 * d);
  const M = RAD * (134.963 + 13.064993 * d);
  const F = RAD * (93.272 + 13.22935 * d);
  const l = L + RAD * 6.289 * Math.sin(M);
  const b = RAD * 5.128 * Math.sin(F);
  const dt = 385001 - 20905 * Math.cos(M);
  return { ra: rightAscension(l, b), dec: declination(l, b), dist: dt };
}

function phaseNameFromPhase01(phase01: number): string {
  const names = [
    "New",
    "Waxing Crescent",
    "First Quarter",
    "Waxing Gibbous",
    "Full",
    "Waning Gibbous",
    "Third Quarter",
    "Waning Crescent",
  ];
  phase01 -= Math.floor(phase01);
  if (phase01 < 0) phase01 += 1;
  const idx = Math.floor(phase01 * 8) % 8;
  return names[idx];
}

interface MoonIllumination {
  fraction: number;
  phase: number;
  angle: number;
  sun_moon_earth_deg: number;
}

function computeIllumination(jd: number): MoonIllumination {
  const d = toDaysFromJd(jd);
  const s = sunCoords(d);
  const m = moonCoords(d);
  const sdist = 149598000;
  const cosPhiRaw =
    Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra);
  const phi = Math.acos(Math.min(1, Math.max(-1, cosPhiRaw)));
  const inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
  const angle = Math.atan2(
    Math.cos(s.dec) * Math.sin(s.ra - m.ra),
    Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra),
  );
  let phase = 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / PI;
  phase -= Math.floor(phase);
  const fraction = (1 + Math.cos(inc)) / 2;
  const sun_moon_earth_deg = inc * (180 / PI);
  return { fraction, phase, angle, sun_moon_earth_deg };
}

function moonPositionHorizon(jd: number, latDeg: number, lonDeg: number): { az: number; alt: number } {
  const lw = RAD * -lonDeg;
  const phi = RAD * latDeg;
  const d = toDaysFromJd(jd);
  const c = moonCoords(d);
  const H = siderealTime(d, lw) - c.ra;
  let h = altitude(H, phi, c.dec);
  h += astroRefraction(h);
  return { az: azimuth(H, phi, c.dec), alt: h };
}

function sunPositionDegrees(jd: number, latDeg: number, lonDeg: number): { azimuth_deg: number; altitude_deg: number } {
  const lw = RAD * -lonDeg;
  const phi = RAD * latDeg;
  const d = toDaysFromJd(jd);
  const c = sunCoords(d);
  const H = siderealTime(d, lw) - c.ra;
  let h = altitude(H, phi, c.dec);
  h += astroRefraction(h);
  const az = azimuth(H, phi, c.dec);
  const deg = 180 / PI;
  return { azimuth_deg: az * deg, altitude_deg: h * deg };
}

function hoursLaterJd(jd: number, hours: number): number {
  return jd + hours / 24;
}

interface MoonTimes {
  rise_jd?: number;
  set_jd?: number;
  always_up?: boolean;
  always_down?: boolean;
}

function moonTimesInInterval(jdStart: number, jdEnd: number, latDeg: number, lonDeg: number): MoonTimes {
  const out: MoonTimes = {};
  if (jdEnd <= jdStart) return out;

  const durationH = (jdEnd - jdStart) * 24;
  const maxI = Math.ceil(durationH);
  const hc = 0.133 * RAD;
  let h0 = moonPositionHorizon(jdStart, latDeg, lonDeg).alt - hc;
  let rise_h: number | undefined;
  let set_h: number | undefined;
  let ye = 0;

  for (let i = 1; i <= maxI; i += 2) {
    const h1 = moonPositionHorizon(hoursLaterJd(jdStart, i), latDeg, lonDeg).alt - hc;
    const h2 = moonPositionHorizon(hoursLaterJd(jdStart, i + 1), latDeg, lonDeg).alt - hc;
    const a = (h0 + h2) / 2 - h1;
    const b = (h2 - h0) / 2;
    const xe = Math.abs(a) < 1e-12 ? 0 : -b / (2 * a);
    const disc = b * b - 4 * a * h1;
    let roots = 0;
    let x1 = 0;
    let x2 = 0;
    ye = (a * xe + b) * xe + h1;

    if (disc >= 0 && Math.abs(a) > 1e-12) {
      const dx = Math.sqrt(disc) / (Math.abs(a) * 2);
      x1 = xe - dx;
      x2 = xe + dx;
      if (Math.abs(x1) <= 1) roots++;
      if (Math.abs(x2) <= 1) roots++;
      if (x1 < -1) x1 = x2;
    }

    if (roots === 1) {
      if (h0 < 0) rise_h = i + x1;
      else set_h = i + x1;
    } else if (roots === 2) {
      rise_h = i + (ye < 0 ? x2 : x1);
      set_h = i + (ye < 0 ? x1 : x2);
    }

    if (rise_h !== undefined && set_h !== undefined) break;
    h0 = h2;
  }

  const inWindow = (jd: number) => jd >= jdStart && jd < jdEnd;
  if (rise_h !== undefined) {
    const riseJd = hoursLaterJd(jdStart, rise_h);
    if (inWindow(riseJd)) out.rise_jd = riseJd;
  }
  if (set_h !== undefined) {
    const setJd = hoursLaterJd(jdStart, set_h);
    if (inWindow(setJd)) out.set_jd = setJd;
  }
  if (out.rise_jd === undefined && out.set_jd === undefined) {
    if (ye > 0) out.always_up = true;
    else out.always_down = true;
  }
  return out;
}

function moonTimesForUtcDay(year: number, month: number, day: number, latDeg: number, lonDeg: number): MoonTimes {
  const jd0 = jdFromUtcYmdHms(year, month, day, 0, 0, 0);
  return moonTimesInInterval(jd0, jd0 + 1, latDeg, lonDeg);
}

function jdFromIso8601Utc(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/.exec(iso);
  if (!m) return null;
  return jdFromUtcYmdHms(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
}

/** Mirrors App.tsx visibility window selection (local civil day when tz resolves, else UTC calendar day). */
function resolveVisibilityWindow(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
  lat: number,
  lon: number,
  preferLocalCivil: boolean,
): { jdStart: number; jdEnd: number } | null {
  const dateUtc = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const timeUtc = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  const tz = getPrimaryTimeZone(lat, lon);
  let bounds = utcCalendarDayBounds(dateUtc);
  if (preferLocalCivil && tz) {
    const local = utcWallClockToLocal(dateUtc, timeUtc, tz);
    if (local) {
      const civil = localCivilDayUtcBounds(local.dateLocal, tz);
      if (civil) bounds = civil;
    }
  }
  if (!bounds) return null;
  const jdStart = jdFromIso8601Utc(bounds.visStartUtc);
  const jdEnd = jdFromIso8601Utc(bounds.visEndUtc);
  if (jdStart === null || jdEnd === null) return null;
  return { jdStart, jdEnd };
}

/** Builds responses matching `moon_api.cpp` `build_json` / `build_sun_json`. */
function moonTimesForRequest(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
  lat: number,
  lon: number,
  options?: { preferLocalCivil?: boolean; visibilityWindow?: VisibilityWindowUtc },
): MoonTimes {
  if (options?.visibilityWindow) {
    const jdStart = jdFromIso8601Utc(options.visibilityWindow.visStartUtc);
    const jdEnd = jdFromIso8601Utc(options.visibilityWindow.visEndUtc);
    if (jdStart !== null && jdEnd !== null) {
      return moonTimesInInterval(jdStart, jdEnd, lat, lon);
    }
  }
  const window = resolveVisibilityWindow(y, m, d, hh, mm, lat, lon, options?.preferLocalCivil ?? true);
  return window
    ? moonTimesInInterval(window.jdStart, window.jdEnd, lat, lon)
    : moonTimesForUtcDay(y, m, d, lat, lon);
}

export function buildMoonSunGoldenResponses(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
  lat: number,
  lon: number,
  options?: { preferLocalCivil?: boolean; visibilityWindow?: VisibilityWindowUtc },
): { moon: MoonApiResponse; sun: SunApiResponse } {
  const jd = jdFromUtcYmdHms(y, m, d, hh, mm, 0);
  const illumination = computeIllumination(jd);
  const phase_name = phaseNameFromPhase01(illumination.phase);
  const times = moonTimesForRequest(y, m, d, hh, mm, lat, lon, options);
  const r = { jd, illumination, phase_name, times };
  const instantUtc = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`;

  const moon: MoonApiResponse = {
    instant_utc: instantUtc,
    location: { latitude: lat, longitude: lon },
    phase: {
      name: r.phase_name,
      cycle_fraction: r.illumination.phase,
      sun_moon_earth_angle_deg: r.illumination.sun_moon_earth_deg,
    },
    illumination: {
      fraction: r.illumination.fraction,
      percent: r.illumination.fraction * 100,
    },
    visibility: buildVisibility(r.times),
  };

  const sunPos = sunPositionDegrees(r.jd, lat, lon);
  const sun: SunApiResponse = {
    instant_utc: instantUtc,
    location: { latitude: lat, longitude: lon },
    position: sunPos,
  };

  return { moon, sun };
}

function buildVisibility(times: MoonTimes): MoonApiResponse["visibility"] {
  if (times.always_up) return { state: "always_up" };
  if (times.always_down) return { state: "always_down" };
  const vis: Extract<MoonApiResponse["visibility"], { state: "normal" }> = { state: "normal" };
  if (times.rise_jd !== undefined) vis.moonrise_utc = iso8601UtcFromJd(times.rise_jd);
  if (times.set_jd !== undefined) vis.moonset_utc = iso8601UtcFromJd(times.set_jd);
  if (times.rise_jd !== undefined && times.set_jd !== undefined) {
    const spanHours = (times.set_jd - times.rise_jd) * 24;
    vis.hours_above_horizon = spanHours >= 0 ? spanHours : -spanHours;
  }
  return vis;
}
