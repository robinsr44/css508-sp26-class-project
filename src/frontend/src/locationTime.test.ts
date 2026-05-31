// TestPlan FE-04 (timezone helpers): see TestStrategy.md.
import { describe, expect, it, vi } from "vitest";

import {
  formatInstantForDisplay,
  formatUtcIsoInZone,
  getPrimaryTimeZone,
  localCivilDayUtcBounds,
  localWallClockToUtc,
  utcCalendarDayBounds,
  utcWallClockToLocal,
} from "./locationTime";

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

describe("formatInstantForDisplay", () => {
  it("uses UTC when useGmt is true regardless of location zone", () => {
    const iso = "2024-06-15T12:00:00.000Z";
    expect(formatInstantForDisplay(iso, true, "America/Los_Angeles")).toBe(formatUtcIsoInZone(iso, "UTC"));
  });

  it("uses the location zone when useGmt is false and a zone exists", () => {
    const iso = "2024-06-15T12:00:00.000Z";
    expect(formatInstantForDisplay(iso, false, "America/Los_Angeles")).toBe(
      formatUtcIsoInZone(iso, "America/Los_Angeles"),
    );
  });

  it("falls back to UTC when no location zone and GMT not requested", () => {
    const iso = "2024-06-15T12:00:00.000Z";
    expect(formatInstantForDisplay(iso, false, null)).toBe(formatUtcIsoInZone(iso, "UTC"));
  });
});

describe("localWallClockToUtc / utcWallClockToLocal", () => {
  it("converts Richmond, VA local noon to UTC during EDT", () => {
    const utc = localWallClockToUtc("2024-06-15", "12:00", "America/New_York");
    expect(utc).toEqual({ dateUtc: "2024-06-15", timeUtc: "16:00" });
    expect(utcWallClockToLocal(utc!.dateUtc, utc!.timeUtc, "America/New_York")).toEqual({
      dateLocal: "2024-06-15",
      timeLocal: "12:00",
    });
  });

  it("converts Sunnyvale, CA local noon to UTC during PDT", () => {
    const utc = localWallClockToUtc("2024-06-15", "12:00", "America/Los_Angeles");
    expect(utc).toEqual({ dateUtc: "2024-06-15", timeUtc: "19:00" });
    expect(utcWallClockToLocal(utc!.dateUtc, utc!.timeUtc, "America/Los_Angeles")).toEqual({
      dateLocal: "2024-06-15",
      timeLocal: "12:00",
    });
  });

  it("rolls the UTC calendar date when local evening crosses midnight UTC", () => {
    const utc = localWallClockToUtc("2024-06-15", "22:00", "America/Los_Angeles");
    expect(utc).toEqual({ dateUtc: "2024-06-16", timeUtc: "05:00" });
  });
});

describe("localCivilDayUtcBounds / utcCalendarDayBounds", () => {
  it("uses PDT midnight boundaries for a Seattle civil day in summer", () => {
    const bounds = localCivilDayUtcBounds("2024-06-15", "America/Los_Angeles");
    expect(bounds).toEqual({
      visStartUtc: "2024-06-15T07:00:00Z",
      visEndUtc: "2024-06-16T07:00:00Z",
    });
  });

  it("uses UTC midnight boundaries for a UTC calendar day", () => {
    expect(utcCalendarDayBounds("2024-06-15")).toEqual({
      visStartUtc: "2024-06-15T00:00:00Z",
      visEndUtc: "2024-06-16T00:00:00Z",
    });
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
    expect(out).toMatch(/12:00/);
    expect(out).not.toMatch(/\b(AM|PM)\b/i);
    expect(out.length).toBeGreaterThan(10);
  });

  it("formats early-morning instants with a 24-hour clock", () => {
    const out = formatUtcIsoInZone("2024-06-15T03:27:00.000Z", "UTC");
    expect(out).toMatch(/03:27/);
    expect(out).not.toMatch(/\b(AM|PM)\b/i);
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
