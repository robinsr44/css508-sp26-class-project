// TestPlan FE-04 (timezone helpers): see TestStrategy.md.
import { describe, expect, it, vi } from "vitest";

import { formatUtcIsoInZone, getPrimaryTimeZone } from "./locationTime";

describe("getPrimaryTimeZone", () => {
  it("returns null when latitude is out of range", () => {
    expect(getPrimaryTimeZone(91, 0)).toBeNull();
    expect(getPrimaryTimeZone(-91, 0)).toBeNull();
  });

  it("returns null when longitude is out of range", () => {
    expect(getPrimaryTimeZone(0, 181)).toBeNull();
    expect(getPrimaryTimeZone(0, -181)).toBeNull();
  });

  it("returns an IANA id for Seattle coordinates", () => {
    const tz = getPrimaryTimeZone(47.6062, -122.3321);
    expect(tz).toBeTruthy();
    expect(tz).toMatch(/^America\//);
  });
});

describe("formatUtcIsoInZone", () => {
  it("returns the input when the instant is not a valid date", () => {
    const bad = "not-an-iso-date";
    expect(formatUtcIsoInZone(bad, "UTC")).toBe(bad);
  });

  it("formats a valid UTC instant in UTC timezone", () => {
    const out = formatUtcIsoInZone("2024-06-15T12:00:00.000Z", "UTC");
    expect(out).toMatch(/2024/);
    expect(out.length).toBeGreaterThan(10);
  });

  it("returns the original string when Intl.DateTimeFormat throws", () => {
    const iso = "2024-06-15T12:00:00.000Z";
    const spy = vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
      throw new Error("simulated Intl failure");
    });
    expect(formatUtcIsoInZone(iso, "UTC")).toBe(iso);
    spy.mockRestore();
  });
});
