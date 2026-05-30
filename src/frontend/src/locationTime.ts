import tzlookup from "tz-lookup";

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return { y, m, d };
}

function parseHhMm(hm: string): { hh: number; mm: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(hm);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return { hh, mm };
}

/** True when `hm` is a valid 24-hour wall-clock time (HH:MM, 00:00–23:59). */
export function isValidTimeHhMm(hm: string): boolean {
  const parts = parseHhMm(hm);
  if (!parts) return false;
  return parts.hh >= 0 && parts.hh <= 23 && parts.mm >= 0 && parts.mm <= 59;
}

function getTimeZoneOffsetMs(timeZone: string, utcInstant: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(utcInstant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - utcInstant.getTime();
}

/** Convert a wall-clock date/time in an IANA zone to UTC date and HH:MM for the API. */
export function localWallClockToUtc(
  dateYmd: string,
  timeHhMm: string,
  timeZone: string,
): { dateUtc: string; timeUtc: string } | null {
  const dateParts = parseYmd(dateYmd);
  const timeParts = parseHhMm(timeHhMm);
  if (!dateParts || !timeParts) return null;
  const { y, m, d } = dateParts;
  const { hh, mm } = timeParts;
  let utcMs = Date.UTC(y, m - 1, d, hh, mm, 0);
  for (let i = 0; i < 3; i++) {
    const offset = getTimeZoneOffsetMs(timeZone, new Date(utcMs));
    const next = Date.UTC(y, m - 1, d, hh, mm, 0) - offset;
    if (next === utcMs) break;
    utcMs = next;
  }
  const result = new Date(utcMs);
  return {
    dateUtc: `${result.getUTCFullYear()}-${pad2(result.getUTCMonth() + 1)}-${pad2(result.getUTCDate())}`,
    timeUtc: `${pad2(result.getUTCHours())}:${pad2(result.getUTCMinutes())}`,
  };
}

/** Convert UTC date and HH:MM to wall-clock date/time in an IANA zone. */
export function utcWallClockToLocal(
  dateUtc: string,
  timeUtc: string,
  timeZone: string,
): { dateLocal: string; timeLocal: string } | null {
  const dateParts = parseYmd(dateUtc);
  const timeParts = parseHhMm(timeUtc);
  if (!dateParts || !timeParts) return null;
  const utcMs = Date.UTC(dateParts.y, dateParts.m - 1, dateParts.d, timeParts.hh, timeParts.mm, 0);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "00";
  let hour = get("hour");
  if (hour === "24") hour = "00";
  return {
    dateLocal: `${get("year")}-${get("month")}-${get("day")}`,
    timeLocal: `${hour}:${get("minute")}`,
  };
}

/** IANA timezone at (lat, lon) using embedded boundary data (tz-lookup). */
export function getPrimaryTimeZone(lat: number, lon: number): string | null {
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  try {
    return tzlookup(lat, lon);
  } catch {
    return null;
  }
}

/** Format a UTC ISO-8601 instant in the given IANA timezone for display (24-hour clock). */
export function formatUtcIsoInZone(isoUtc: string, timeZone: string): string {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return isoUtc;
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(d);
  } catch {
    return isoUtc;
  }
}

/** Format for the observation location, or UTC when no IANA zone is available. */
export function formatInstantForDisplay(
  isoUtc: string,
  useGmt: boolean,
  locationTimeZone: string | null,
): string {
  const zone = useGmt || !locationTimeZone ? "UTC" : locationTimeZone;
  return formatUtcIsoInZone(isoUtc, zone);
}
