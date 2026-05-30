/**
 * Golden checks for the TypeScript ephemeris mirror (aligned with moon_ephemeris.cpp / moon_api.cpp).
 */
import { describe, expect, it } from "vitest";

import { buildMoonSunGoldenResponses, jdFromUtcYmdHms, iso8601UtcFromJd } from "./ephemerisMirror";

const kEpsFrac = 1e-9;
const kEpsDeg = 1e-2;

describe("ephemerisMirror — Julian / ISO helpers", () => {
  it("jdFromUtcYmdHms matches J2000 reference", () => {
    const jd = jdFromUtcYmdHms(2000, 1, 1, 12, 0, 0);
    expect(jd).toBeCloseTo(2451545.0, 6);
  });

  it("iso8601UtcFromJd round-trips a known instant", () => {
    const jd = jdFromUtcYmdHms(2024, 6, 15, 12, 0, 0);
    expect(iso8601UtcFromJd(jd)).toMatch(/^2024-06-15T12:00:00/);
  });
});

describe("ephemerisMirror — buildMoonSunGoldenResponses", () => {
  it("mid-latitude summer day has normal visibility with rise, set, and hours", () => {
    const { moon } = buildMoonSunGoldenResponses(2024, 6, 15, 12, 0, 47.6, -122.33);
    expect(moon.visibility.state).toBe("normal");
    if (moon.visibility.state !== "normal") return;
    expect(moon.visibility.moonrise_utc).toBeDefined();
    expect(moon.visibility.moonset_utc).toBeDefined();
    expect(moon.visibility.hours_above_horizon).toBeCloseTo(12.876987632364035, 5);
    expect(moon.illumination.fraction).toBeCloseTo(0.6236824221829433, kEpsFrac);
  });

  it("high-latitude winter can be always_down", () => {
    const { moon } = buildMoonSunGoldenResponses(2024, 1, 15, 12, 0, 89, 0);
    expect(moon.visibility.state).toBe("always_down");
  });

  it("high-latitude summer can be always_up", () => {
    const { moon } = buildMoonSunGoldenResponses(2024, 7, 1, 12, 0, 89, 0);
    expect(moon.visibility.state).toBe("always_up");
  });

  it("sun position matches fixed azimuth/altitude for Seattle noon fixture", () => {
    const { sun } = buildMoonSunGoldenResponses(2024, 6, 15, 12, 0, 47.6, -122.33);
    expect(sun.position.azimuth_deg).toBeCloseTo(-129.2223692746813, kEpsDeg);
    expect(sun.position.altitude_deg).toBeCloseTo(-1.8522139766027779, kEpsDeg);
  });

  it("polar visibility omits rise, set, and hours fields", () => {
    const { moon } = buildMoonSunGoldenResponses(2024, 1, 15, 12, 0, 89, 0);
    expect(moon.visibility).toEqual({ state: "always_down" });
  });
});
