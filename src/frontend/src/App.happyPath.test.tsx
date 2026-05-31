/**
 * Happy-path integration-style tests: mocked Nominatim + mocked `/api/moon` & `/api/sun` driven by
 * the same ephemeris mirror as `moon_ephemeris.cpp` so expectations stay aligned with `moon-api`.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import type { MoonApiResponse, SunApiResponse } from "./api";
import { formatInstantForDisplay, getPrimaryTimeZone } from "./locationTime";
import { phaseDisplayName } from "./phaseDisplayName";
import { buildMoonSunGoldenResponses } from "./test/ephemerisMirror";
import { fillCoordinates } from "./test/locationForm";
import { resultTimeDisplayGroup, useUtcTimeEntry } from "./test/timeToggle";

function computeButton(container: HTMLElement) {
  const form = container.querySelector("form.card");
  if (!form) throw new Error("Expected form.card");
  return within(form).getByRole("button", { name: /compute/i });
}

function versionResponse() {
  return new Response(JSON.stringify({ service: "moon-api", version: "1.1.0" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** 29 UTC-calendar days starting 2026-01-15 (covers roughly one synodic month). */
const MOON_CYCLE_DATES: string[] = Array.from({ length: 29 }, (_, i) => {
  const ms = Date.UTC(2026, 0, 15 + i);
  const dt = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
});

const SEATTLE_LAT = 47.6062;
const SEATTLE_LON = -122.3321;

function moonSunFetchHandler() {
  return async (input: RequestInfo | URL): Promise<Response> => {
    const raw = typeof input === "string" ? input : input.toString();
    if (raw.includes("/api/version")) return versionResponse();
    const url = raw.startsWith("http") ? raw : `http://localhost${raw}`;
    if (raw.includes("/api/moon") || raw.includes("/api/sun")) {
      const u = new URL(url);
      const dateStr = u.searchParams.get("date");
      const latQ = Number(u.searchParams.get("lat"));
      const lonQ = Number(u.searchParams.get("lon"));
      const timeStr = u.searchParams.get("time") ?? "12:00";
      const [th, tm] = timeStr.split(":").map(Number);
      expect(Number.isFinite(latQ)).toBe(true);
      expect(Number.isFinite(lonQ)).toBe(true);
      if (!dateStr) return new Response(JSON.stringify({ error: "missing date" }), { status: 400 });

      const [y, mo, d] = dateStr.split("-").map(Number);
      const visStart = u.searchParams.get("vis_start_utc");
      const visEnd = u.searchParams.get("vis_end_utc");
      const golden = buildMoonSunGoldenResponses(y, mo, d, th, tm, latQ, lonQ, {
        visibilityWindow:
          visStart && visEnd ? { visStartUtc: visStart, visEndUtc: visEnd } : undefined,
      });
      const body = raw.includes("/api/moon") ? golden.moon : golden.sun;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("not found", { status: 404 });
  };
}

describe("happy path — location search updates coordinates", () => {
  type NomHit = { lat: string; lon: string; display_name: string };

  const FIXTURES: Record<string, NomHit> = {
    "Richmond, VA": {
      lat: "37.5388577",
      lon: "-77.4338395",
      display_name: "Richmond, Virginia, United States",
    },
    Oslo: {
      lat: "59.9133301",
      lon: "10.7389701",
      display_name: "Oslo, Norway",
    },
    Sydney: {
      lat: "-33.8651439",
      lon: "151.2099003",
      display_name: "Sydney, New South Wales, Australia",
    },
  };

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const raw = typeof input === "string" ? input : input.toString();
        if (raw.includes("/api/version")) return versionResponse();
        if (raw.includes("nominatim.openstreetmap.org")) {
          const url = raw.startsWith("http") ? raw : `http://localhost${raw}`;
          const q = decodeURIComponent(new URL(url).searchParams.get("q") ?? "");
          const hit = FIXTURES[q];
          if (!hit) return new Response(JSON.stringify([]), { status: 200 });
          return new Response(JSON.stringify([hit]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (raw.includes("/api/moon")) {
          const url = new URL(raw.startsWith("http") ? raw : `http://localhost${raw}`);
          const lat = Number(url.searchParams.get("lat"));
          const lon = Number(url.searchParams.get("lon"));
          const date = url.searchParams.get("date") ?? "2026-01-15";
          const time = url.searchParams.get("time") ?? "12:00";
          const moon: MoonApiResponse = {
            instant_utc: `${date}T${time}:00Z`,
            location: { latitude: lat, longitude: lon },
            phase: { name: "Full", cycle_fraction: 0.5, sun_moon_earth_angle_deg: 90 },
            illumination: { fraction: 1, percent: 100 },
            visibility: { state: "always_down" },
          };
          return new Response(JSON.stringify(moon), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (raw.includes("/api/sun")) {
          const url = new URL(raw.startsWith("http") ? raw : `http://localhost${raw}`);
          const lat = Number(url.searchParams.get("lat"));
          const lon = Number(url.searchParams.get("lon"));
          const date = url.searchParams.get("date") ?? "2026-01-15";
          const time = url.searchParams.get("time") ?? "12:00";
          const sun: SunApiResponse = {
            instant_utc: `${date}T${time}:00Z`,
            location: { latitude: lat, longitude: lon },
            position: { azimuth_deg: 0, altitude_deg: 30 },
          };
          return new Response(JSON.stringify(sun), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("not found", { status: 404 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it.each([
    ["Richmond, VA", "37.5389", "-77.4338"],
    ["Oslo", "59.9133", "10.7390"],
    ["Sydney", "-33.8651", "151.2099"],
  ] as const)("search %# sets lat/lon for %s", async (query, expectedLat, expectedLon) => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.type(screen.getByPlaceholderText(/city/i), query);
    await user.click(screen.getByRole("button", { name: /^search$/i }));

    expect(await screen.findByText(FIXTURES[query].display_name)).toBeInTheDocument();

    expect(screen.getByLabelText(/latitude/i)).toHaveValue(expectedLat);
    expect(screen.getByLabelText(/longitude/i)).toHaveValue(expectedLon);
    expect(computeButton(container)).not.toBeDisabled();
  });

  it("compute resolves a typed city without clicking Search and shows that timezone in results", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.type(screen.getByPlaceholderText(/city/i), "Richmond, VA");
    await useUtcTimeEntry(user);
    await user.clear(screen.getByLabelText(/^date(\s*\(local\)|\s*\(UTC\))?$/i));
    await user.type(screen.getByLabelText(/^date(\s*\(local\)|\s*\(UTC\))?$/i), "2026-05-30");
    await user.clear(screen.getByLabelText(/^time(\s*\(local\)|\s*\(UTC\))?$/i));
    await user.type(screen.getByLabelText(/^time(\s*\(local\)|\s*\(UTC\))?$/i), "03:27");

    await user.click(computeButton(container));

    expect((await screen.findAllByText(FIXTURES["Richmond, VA"].display_name)).length).toBeGreaterThan(0);
    expect(document.querySelector(".result-location-name")).toHaveTextContent(
      FIXTURES["Richmond, VA"].display_name,
    );
    expect(screen.getByLabelText(/latitude/i)).toHaveValue("37.5389");
    expect(screen.getByLabelText(/longitude/i)).toHaveValue("-77.4338");

    await user.click(resultTimeDisplayGroup().getByRole("button", { name: /^local$/i }));

    const richmondTz = getPrimaryTimeZone(37.5388577, -77.4338395);
    expect(richmondTz).toMatch(/New_York/);
    const expectedLocal = formatInstantForDisplay("2026-05-30T03:27:00Z", false, richmondTz);
    expect(screen.getAllByText(expectedLocal).length).toBeGreaterThan(0);
    expect(screen.queryByText(/PDT/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/EDT/i).length).toBeGreaterThan(0);
  });
});

describe("happy path — moon cycle (mirror ephemeris)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(moonSunFetchHandler()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it.each(MOON_CYCLE_DATES)("phase & sun for %s (UTC noon, Seattle)", async (dateStr) => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await fillCoordinates(user, String(SEATTLE_LAT), String(SEATTLE_LON));
    await useUtcTimeEntry(user);

    await user.clear(screen.getByLabelText(/^date(\s*\(local\)|\s*\(UTC\))?$/i));
    await user.type(screen.getByLabelText(/^date(\s*\(local\)|\s*\(UTC\))?$/i), dateStr);
    await user.clear(screen.getByLabelText(/^time(\s*\(local\)|\s*\(UTC\))?$/i));
    await user.type(screen.getByLabelText(/^time(\s*\(local\)|\s*\(UTC\))?$/i), "12:00");

    await user.click(computeButton(container));

    const [y, mo, d] = dateStr.split("-").map(Number);
    const { moon: goldenMoon, sun: goldenSun } = buildMoonSunGoldenResponses(y, mo, d, 12, 0, SEATTLE_LAT, SEATTLE_LON);

    const expectedPhase = phaseDisplayName(goldenMoon);

    expect(await screen.findByRole("heading", { name: /^Sun position$/i })).toBeInTheDocument();

    const phaseHeading = screen.getByRole("heading", { name: /^phase$/i });
    expect(phaseHeading.parentElement?.querySelector("strong")).toHaveTextContent(expectedPhase);

    expect(screen.getByText(`${goldenSun.position.altitude_deg.toFixed(1)}°`)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${goldenSun.position.azimuth_deg.toFixed(1)}°`))).toBeInTheDocument();

    const tz = getPrimaryTimeZone(SEATTLE_LAT, SEATTLE_LON);
    expect(tz).not.toBeNull();

    const illuminationBlock = screen.getByRole("heading", { name: /^illumination$/i }).closest(".result-item");
    expect(illuminationBlock).toBeTruthy();

    const expectedUtcLine = formatInstantForDisplay(goldenMoon.instant_utc, true, tz);
    expect(within(illuminationBlock!).getByText(expectedUtcLine)).toBeInTheDocument();

    await user.click(resultTimeDisplayGroup().getByRole("button", { name: /^local$/i }));

    const expectedLocal = formatInstantForDisplay(goldenMoon.instant_utc, false, tz);
    expect(within(illuminationBlock!).getByText(expectedLocal)).toBeInTheDocument();

    await user.click(resultTimeDisplayGroup().getByRole("button", { name: /^UTC$/ }));
    expect(within(illuminationBlock!).getByText(expectedUtcLine)).toBeInTheDocument();
  });
});
