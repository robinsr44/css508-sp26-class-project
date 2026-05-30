/**
 * Optional live golden checks against a running moon-api (CI starts moon-api on 8080 before Vitest).
 * Skipped when /api/health is unreachable.
 */
import { beforeAll, describe, expect, it } from "vitest";

import type { MoonApiResponse, SunApiResponse } from "../api";
import { buildMoonSunGoldenResponses } from "./ephemerisMirror";

const API_BASE = process.env.MOON_API_BASE_URL ?? "http://127.0.0.1:8080";
const kEpsFrac = 1e-6;
const kEpsDeg = 0.05;
const kEpsHours = 0.02;

let apiLive = false;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  expect(res.ok).toBe(true);
  return (await res.json()) as T;
}

describe("ephemerisMirror vs live moon-api", () => {
  beforeAll(async () => {
    try {
      const health = await fetch(`${API_BASE}/api/health`);
      if (!health.ok) return;
      const body = (await health.json()) as { status?: string };
      apiLive = body.status === "ok";
    } catch {
      apiLive = false;
    }
  });

  it.skipIf(() => !apiLive)("GET /api/moon matches mirror for mid-latitude fixture", async () => {
    const lat = 47.6;
    const lon = -122.33;
    const date = "2024-06-15";
    const time = "12:00";
    const golden = buildMoonSunGoldenResponses(2024, 6, 15, 12, 0, lat, lon);

    const live = await fetchJson<MoonApiResponse>(
      `/api/moon?lat=${lat}&lon=${lon}&date=${date}&time=${time}`,
    );

    expect(live.visibility.state).toBe(golden.moon.visibility.state);
    expect(live.illumination.fraction).toBeCloseTo(golden.moon.illumination.fraction, kEpsFrac);
    if (live.visibility.state === "normal" && golden.moon.visibility.state === "normal") {
      expect(live.visibility.hours_above_horizon).toBeCloseTo(
        golden.moon.visibility.hours_above_horizon ?? 0,
        kEpsHours,
      );
    }
  });

  it.skipIf(() => !apiLive)("GET /api/sun matches mirror for same instant", async () => {
    const lat = 47.6;
    const lon = -122.33;
    const golden = buildMoonSunGoldenResponses(2024, 6, 15, 12, 0, lat, lon);

    const live = await fetchJson<SunApiResponse>(
      `/api/sun?lat=${lat}&lon=${lon}&date=2024-06-15&time=12:00`,
    );

    expect(live.position.azimuth_deg).toBeCloseTo(golden.sun.position.azimuth_deg, kEpsDeg);
    expect(live.position.altitude_deg).toBeCloseTo(golden.sun.position.altitude_deg, kEpsDeg);
  });

  it.skipIf(() => !apiLive)("polar fixture matches always_down visibility state", async () => {
    const live = await fetchJson<MoonApiResponse>(
      "/api/moon?lat=89&lon=0&date=2024-01-15&time=12:00",
    );
    const golden = buildMoonSunGoldenResponses(2024, 1, 15, 12, 0, 89, 0);
    expect(live.visibility.state).toBe(golden.moon.visibility.state);
  });
});
