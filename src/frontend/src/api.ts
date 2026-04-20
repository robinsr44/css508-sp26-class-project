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

export type SunApiResponse = {
  instant_utc: string;
  location: { latitude: number; longitude: number };
  position: { azimuth_deg: number; altitude_deg: number };
};

function parseMoonJson(text: string): MoonApiResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      "The server did not return JSON. Is moon-api running on port 8080? (Vite proxies /api to 127.0.0.1:8080.)",
    );
  }
  const o = parsed as Record<string, unknown>;
  if (typeof o.instant_utc !== "string" || typeof o.phase !== "object" || o.phase === null) {
    throw new Error("Unexpected API response shape.");
  }
  return parsed as MoonApiResponse;
}

function parseSunJson(text: string): SunApiResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      "The server did not return JSON. Is moon-api running on port 8080? (Vite proxies /api to 127.0.0.1:8080.)",
    );
  }
  const o = parsed as Record<string, unknown>;
  if (typeof o.instant_utc !== "string" || typeof o.position !== "object" || o.position === null) {
    throw new Error("Unexpected API response shape.");
  }
  return parsed as SunApiResponse;
}

async function handleApiError(res: Response, text: string): Promise<never> {
  let msg = `HTTP ${res.status}`;
  try {
    const j = JSON.parse(text) as { error?: string };
    if (j.error) msg = j.error;
  } catch {
    if (text.trim().length > 0) msg = `${msg}: ${text.slice(0, 120)}`;
  }
  throw new Error(msg);
}

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
  let res: Response;
  try {
    res = await fetch(`/api/moon?${q.toString()}`);
  } catch (e) {
    const isNetwork =
      e instanceof TypeError &&
      (e.message === "Failed to fetch" ||
        e.message.includes("NetworkError") ||
        e.message.includes("Load failed"));
    if (isNetwork) {
      throw new Error(
        "Cannot reach the API. Start the backend on port 8080 (e.g. run moon-api or `docker compose up`), then try again. With `npm run dev`, /api is proxied to http://127.0.0.1:8080.",
      );
    }
    throw e;
  }
  const text = await res.text();
  if (!res.ok) {
    await handleApiError(res, text);
  }
  return parseMoonJson(text);
}

export async function fetchSun(params: {
  lat: number;
  lon: number;
  date: string;
  timeUtc: string;
}): Promise<SunApiResponse> {
  const q = new URLSearchParams({
    lat: String(params.lat),
    lon: String(params.lon),
    date: params.date,
    time: params.timeUtc,
  });
  let res: Response;
  try {
    res = await fetch(`/api/sun?${q.toString()}`);
  } catch (e) {
    const isNetwork =
      e instanceof TypeError &&
      (e.message === "Failed to fetch" ||
        e.message.includes("NetworkError") ||
        e.message.includes("Load failed"));
    if (isNetwork) {
      throw new Error(
        "Cannot reach the API. Start the backend on port 8080 (e.g. run moon-api or `docker compose up`), then try again. With `npm run dev`, /api is proxied to http://127.0.0.1:8080.",
      );
    }
    throw e;
  }
  const text = await res.text();
  if (!res.ok) {
    await handleApiError(res, text);
  }
  return parseSunJson(text);
}

export type VersionApiResponse = { version: string; service: string };

export async function fetchVersion(): Promise<VersionApiResponse> {
  let res: Response;
  try {
    res = await fetch("/api/version");
  } catch (e) {
    const isNetwork =
      e instanceof TypeError &&
      (e.message === "Failed to fetch" ||
        e.message.includes("NetworkError") ||
        e.message.includes("Load failed"));
    if (isNetwork) {
      throw new Error(
        "Cannot reach the API. Start the backend on port 8080. With `npm run dev`, /api is proxied to http://127.0.0.1:8080.",
      );
    }
    throw e;
  }
  const text = await res.text();
  if (!res.ok) {
    await handleApiError(res, text);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Unexpected API response.");
  }
  return parsed as VersionApiResponse;
}
