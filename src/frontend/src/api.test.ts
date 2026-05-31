// TestPlan FE-03 (API client errors) + fetch URL/shape tests: see TestStrategy.md.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchMoon, fetchSun, fetchVersion } from "./api";

const validMoonBody = {
  instant_utc: "2024-06-15T12:00:00Z",
  location: { latitude: 47.6, longitude: -122.33 },
  phase: {
    name: "Full",
    cycle_fraction: 0.5,
    sun_moon_earth_angle_deg: 12.3,
  },
  illumination: { fraction: 0.5, percent: 50 },
  visibility: { state: "normal" as const },
};

const validSunBody = {
  instant_utc: "2024-06-15T12:00:00Z",
  location: { latitude: 47.6, longitude: -122.33 },
  position: { azimuth_deg: 180.0, altitude_deg: 45.0 },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchMoon", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests /api/moon with query params from arguments", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(jsonResponse(validMoonBody));

    await fetchMoon({
      lat: 47.6,
      lon: -122.33,
      date: "2024-06-15",
      timeUtc: "12:00",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/api/moon?");
    expect(url).toContain("lat=47.6");
    expect(url).toContain("lon=-122.33");
    expect(url).toContain("date=2024-06-15");
    expect(url).toContain("time=12%3A00");
  });

  it("includes visibility window query params when provided", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(jsonResponse(validMoonBody));

    await fetchMoon({
      lat: 47.6,
      lon: -122.33,
      date: "2024-06-15",
      timeUtc: "12:00",
      visibilityWindow: {
        visStartUtc: "2024-06-15T07:00:00Z",
        visEndUtc: "2024-06-16T07:00:00Z",
      },
    });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("vis_start_utc=2024-06-15T07%3A00%3A00Z");
    expect(url).toContain("vis_end_utc=2024-06-16T07%3A00%3A00Z");
  });

  it("returns parsed JSON on 200", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse(validMoonBody));

    const out = await fetchMoon({
      lat: 0,
      lon: 0,
      date: "2024-01-01",
      timeUtc: "00:00",
    });

    expect(out.instant_utc).toBe(validMoonBody.instant_utc);
    expect(out.phase.name).toBe("Full");
    expect(out.visibility.state).toBe("normal");
  });

  it("throws with server error message on non-OK JSON body", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse({ error: "date must be YYYY-MM-DD" }, 400),
    );

    await expect(
      fetchMoon({ lat: 0, lon: 0, date: "bad", timeUtc: "12:00" }),
    ).rejects.toThrow("date must be YYYY-MM-DD");
  });

  it("throws on non-JSON error body", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response("plain text error", { status: 500, headers: { "Content-Type": "text/plain" } }),
    );

    await expect(
      fetchMoon({ lat: 0, lon: 0, date: "2024-06-15", timeUtc: "12:00" }),
    ).rejects.toThrow(/HTTP 500/);
  });

  it("throws on 200 with unexpected shape", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ phase: {} }));

    await expect(
      fetchMoon({ lat: 0, lon: 0, date: "2024-06-15", timeUtc: "12:00" }),
    ).rejects.toThrow(/Unexpected API response shape/);
  });

  it("throws helpful message on network failure", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(
      fetchMoon({ lat: 0, lon: 0, date: "2024-06-15", timeUtc: "12:00" }),
    ).rejects.toThrow(/Cannot reach the API/);
  });

  it("parses always_up visibility without rise/set fields", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse({
        ...validMoonBody,
        visibility: { state: "always_up" },
      }),
    );

    const out = await fetchMoon({
      lat: 89,
      lon: 0,
      date: "2024-01-15",
      timeUtc: "12:00",
    });

    expect(out.visibility.state).toBe("always_up");
  });

  it("parses always_down visibility", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse({
        ...validMoonBody,
        visibility: { state: "always_down" },
      }),
    );

    const out = await fetchMoon({
      lat: 89,
      lon: 0,
      date: "2024-01-15",
      timeUtc: "12:00",
    });

    expect(out.visibility.state).toBe("always_down");
  });

  it("parses normal visibility with hours_above_horizon", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse({
        ...validMoonBody,
        visibility: {
          state: "normal",
          moonrise_utc: "2024-06-15T08:00:00Z",
          moonset_utc: "2024-06-16T04:00:00Z",
          hours_above_horizon: 12.34,
        },
      }),
    );

    const out = await fetchMoon({
      lat: 47.6,
      lon: -122.33,
      date: "2024-06-15",
      timeUtc: "12:00",
    });

    expect(out.visibility.state).toBe("normal");
    if (out.visibility.state === "normal") {
      expect(out.visibility.hours_above_horizon).toBe(12.34);
    }
  });
});

describe("fetchSun", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests /api/sun with query params", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(jsonResponse(validSunBody));

    await fetchSun({
      lat: 1,
      lon: 2,
      date: "2024-03-01",
      timeUtc: "09:30",
    });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/api/sun?");
    expect(url).toContain("time=09%3A30");
  });

  it("returns parsed JSON on 200", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse(validSunBody));

    const out = await fetchSun({
      lat: 0,
      lon: 0,
      date: "2024-06-15",
      timeUtc: "12:00",
    });

    expect(out.position.azimuth_deg).toBe(180.0);
    expect(out.position.altitude_deg).toBe(45.0);
  });

  it("throws on 200 with missing position", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ instant_utc: "x" }));

    await expect(
      fetchSun({ lat: 0, lon: 0, date: "2024-06-15", timeUtc: "12:00" }),
    ).rejects.toThrow(/Unexpected API response shape/);
  });

  it("throws with server error message on non-OK JSON body", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse({ error: "invalid sun params" }, 400),
    );

    await expect(
      fetchSun({ lat: 0, lon: 0, date: "bad", timeUtc: "12:00" }),
    ).rejects.toThrow("invalid sun params");
  });

  it("throws on non-JSON error body", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response("gateway timeout", { status: 502, headers: { "Content-Type": "text/plain" } }),
    );

    await expect(
      fetchSun({ lat: 0, lon: 0, date: "2024-06-15", timeUtc: "12:00" }),
    ).rejects.toThrow(/HTTP 502/);
  });

  it("throws helpful message on network failure", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(
      fetchSun({ lat: 0, lon: 0, date: "2024-06-15", timeUtc: "12:00" }),
    ).rejects.toThrow(/Cannot reach the API/);
  });
});

describe("fetchVersion", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns version and service on 200", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse({ service: "moon-api", version: "1.1.0" }),
    );

    const v = await fetchVersion();
    expect(v.service).toBe("moon-api");
    expect(v.version).toBe("1.1.0");
  });

  it("throws on invalid JSON body", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response("not json", { status: 200 }));

    await expect(fetchVersion()).rejects.toThrow(/Unexpected API response/);
  });

  it("throws helpful message on network failure", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(fetchVersion()).rejects.toThrow(/Cannot reach the API/);
  });

  it("throws with server error message on non-OK JSON body", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse({ error: "not found" }, 404));

    await expect(fetchVersion()).rejects.toThrow("not found");
  });
});
