import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NOMINATIM_MIN_INTERVAL_MS,
  NOMINATIM_USER_AGENT,
  resetNominatimClientForTests,
  searchNominatim,
} from "./nominatim";

function parisResponse() {
  return new Response(
    JSON.stringify([{ lat: "48.8566", lon: "2.3522", display_name: "Paris, France" }]),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function tokyoResponse() {
  return new Response(
    JSON.stringify([{ lat: "35.6762", lon: "139.6503", display_name: "Tokyo, Japan" }]),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("searchNominatim", () => {
  beforeEach(() => {
    resetNominatimClientForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    resetNominatimClientForTests();
  });

  it("sends a custom User-Agent identifying the application", async () => {
    const fetchMock = vi.fn(async () => parisResponse());
    vi.stubGlobal("fetch", fetchMock);

    await searchNominatim("Paris");

    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init?.headers).toMatchObject({
      Accept: "application/json",
      "User-Agent": NOMINATIM_USER_AGENT,
    });
  });

  it("returns null for an empty result list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })),
    );

    await expect(searchNominatim("Nowhereville")).resolves.toBeNull();
  });

  it("serves repeated queries from cache without another network request", async () => {
    const fetchMock = vi.fn(async () => parisResponse());
    vi.stubGlobal("fetch", fetchMock);

    await searchNominatim("Paris");
    await searchNominatim("  paris  ");

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("caches empty results", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchNominatim("Nowhereville")).resolves.toBeNull();
    await expect(searchNominatim("nowhereville")).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("deduplicates concurrent requests for the same query", async () => {
    const fetchMock = vi.fn(async () => parisResponse());
    vi.stubGlobal("fetch", fetchMock);

    const [a, b] = await Promise.all([searchNominatim("Paris"), searchNominatim("Paris")]);

    expect(a).toEqual({ lat: 48.8566, lon: 2.3522, displayName: "Paris, France" });
    expect(b).toEqual(a);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it(`waits at least ${NOMINATIM_MIN_INTERVAL_MS}ms between different network requests`, async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("Paris")) return parisResponse();
      return tokyoResponse();
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = searchNominatim("Paris");
    await vi.runAllTimersAsync();
    await first;
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = searchNominatim("Tokyo");
    await vi.advanceTimersByTimeAsync(NOMINATIM_MIN_INTERVAL_MS - 1);
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await second;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("aborts while waiting for the rate limit", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => parisResponse());
    vi.stubGlobal("fetch", fetchMock);

    await searchNominatim("Paris");
    await vi.runAllTimersAsync();

    const controller = new AbortController();
    const pending = searchNominatim("Tokyo", controller.signal);
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
