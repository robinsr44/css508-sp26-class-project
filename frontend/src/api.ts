export type MoonVisibility =
  | { state: "normal"; moonrise_utc?: string; moonset_utc?: string; hours_above_horizon?: number }
  | { state: "always_up" }
  | { state: "always_down" };

export type MoonApiResponse = {
  instant_utc: string;
  location: { latitude: number; longitude: number };
  phase: { name: string; cycle_fraction: number; sun_moon_earth_angle_deg: number };
  illumination: { fraction: number; percent: number };
  visibility: MoonVisibility;
};

export async function fetchMoon(params: {
  lat: number;
  lon: number;
  date: string;
  timeUtc: string;
}): Promise<MoonApiResponse> {
  const q = new URLSearchParams({
    lat: String(params.lat),
    lon: String(params.lon),
    date: params.date,
    time: params.timeUtc,
  });
  const res = await fetch(`/api/moon?${q.toString()}`);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<MoonApiResponse>;
}
