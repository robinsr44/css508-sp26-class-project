import { describe, expect, it } from "vitest";

import type { MoonApiResponse } from "./api";
import { phaseDisplayName } from "./phaseDisplayName";

function moonRow(overrides: {
  fraction?: number;
  percent?: number;
  cycle_fraction?: number;
  apiName?: string;
}): MoonApiResponse {
  const fraction = overrides.fraction ?? 0.5;
  const percent = overrides.percent ?? fraction * 100;
  return {
    instant_utc: "2024-06-15T12:00:00Z",
    location: { latitude: 0, longitude: 0 },
    phase: {
      name: overrides.apiName ?? "Waxing Gibbous",
      cycle_fraction: overrides.cycle_fraction ?? 0.3,
      sun_moon_earth_angle_deg: 90,
    },
    illumination: { fraction, percent },
    visibility: { state: "normal" },
  };
}

describe("phaseDisplayName", () => {
  it.each([
    { label: "New via percent < 1%", row: moonRow({ fraction: 0.5, percent: 0.5, cycle_fraction: 0.05 }), expected: "New" },
    { label: "New via fraction < 1%", row: moonRow({ fraction: 0.005, percent: undefined, cycle_fraction: 0.05 }), expected: "New" },
    { label: "Full via percent > 99%", row: moonRow({ fraction: 0.5, percent: 99.5, cycle_fraction: 0.5 }), expected: "Full" },
    { label: "Full via fraction > 99%", row: moonRow({ fraction: 0.995, percent: undefined, cycle_fraction: 0.5 }), expected: "Full" },
    { label: "waxing crescent at 48%", row: moonRow({ fraction: 0.48, percent: 48, cycle_fraction: 0.2 }), expected: "Waxing Crescent" },
    { label: "waning crescent at 48%", row: moonRow({ fraction: 0.48, percent: 48, cycle_fraction: 0.8 }), expected: "Waning Crescent" },
    { label: "waxing quarter band", row: moonRow({ fraction: 0.5, percent: 50, cycle_fraction: 0.25 }), expected: "First Quarter" },
    { label: "waning quarter band", row: moonRow({ fraction: 0.5, percent: 50, cycle_fraction: 0.75 }), expected: "Third Quarter" },
    { label: "waxing gibbous", row: moonRow({ fraction: 0.72, percent: 72, cycle_fraction: 0.3 }), expected: "Waxing Gibbous" },
    { label: "waning gibbous", row: moonRow({ fraction: 0.72, percent: 72, cycle_fraction: 0.7 }), expected: "Waning Gibbous" },
  ] as const)("$label", ({ row, expected }) => {
    expect(phaseDisplayName(row)).toBe(expected);
  });

  it("falls back to API phase name when illumination fraction is not a number", () => {
    const row = moonRow({ apiName: "Custom Phase" });
    (row.illumination as { fraction?: number }).fraction = undefined;
    expect(phaseDisplayName(row)).toBe("Custom Phase");
  });

  it("ignores eighth-bucket API name when illumination band differs", () => {
    expect(
      phaseDisplayName(
        moonRow({
          apiName: "First Quarter",
          fraction: 0.72,
          percent: 72,
          cycle_fraction: 0.3,
        }),
      ),
    ).toBe("Waxing Gibbous");
  });
});
