import tzlookup from "tz-lookup";

/** IANA timezone at (lat, lon) using embedded boundary data (tz-lookup). */
export function getPrimaryTimeZone(lat: number, lon: number): string | null {
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  try {
    return tzlookup(lat, lon);
  } catch {
    return null;
  }
}

/** Format a UTC ISO-8601 instant in the given IANA timezone for display. */
export function formatUtcIsoInZone(isoUtc: string, timeZone: string): string {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return isoUtc;
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
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
