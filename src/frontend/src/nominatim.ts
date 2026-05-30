/** Nominatim public API — https://operations.osmfoundation.org/policies/nominatim/ */
export const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

/** OSM policy: absolute maximum of one request per second per application. */
export const NOMINATIM_MIN_INTERVAL_MS = 1000;

/** Identifies this app to OSM (required; stock browser/library UAs are not accepted). */
export const NOMINATIM_USER_AGENT =
  "MoonTracker/0.1.0 (CSS508-sp26-class-project; educational moon phase UI)";

export type NominatimSearchResult = {
  lat: number;
  lon: number;
  displayName: string;
};

type NominatimHit = { lat: string; lon: string; display_name: string };

const resultCache = new Map<string, NominatimSearchResult | null>();
const inFlight = new Map<string, Promise<NominatimSearchResult | null>>();
let lastNetworkRequestAt = 0;
let throttleChain: Promise<void> = Promise.resolve();

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("The operation was aborted.", "AbortError");
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal!.reason ?? new DOMException("The operation was aborted.", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function waitForRateLimit(signal?: AbortSignal): Promise<void> {
  throttleChain = throttleChain.then(async () => {
    const elapsed = Date.now() - lastNetworkRequestAt;
    const waitMs = Math.max(0, NOMINATIM_MIN_INTERVAL_MS - elapsed);
    await abortableDelay(waitMs, signal);
    lastNetworkRequestAt = Date.now();
  });
  return throttleChain;
}

async function fetchNominatim(
  query: string,
  signal?: AbortSignal,
): Promise<NominatimSearchResult | null> {
  const url = `${NOMINATIM_SEARCH_URL}?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": NOMINATIM_USER_AGENT,
    },
    signal,
  });
  if (!res.ok) throw new Error("Search request failed.");
  const results = (await res.json()) as NominatimHit[];
  if (results.length === 0) return null;
  return {
    lat: parseFloat(results[0].lat),
    lon: parseFloat(results[0].lon),
    displayName: results[0].display_name,
  };
}

/** Clears client-side cache and rate-limit state (tests only). */
export function resetNominatimClientForTests(): void {
  resultCache.clear();
  inFlight.clear();
  lastNetworkRequestAt = 0;
  throttleChain = Promise.resolve();
}

/** Forward geocode a place name via Nominatim. Returns null when there are no hits. */
export async function searchNominatim(
  query: string,
  signal?: AbortSignal,
): Promise<NominatimSearchResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const cacheKey = normalizeQuery(trimmed);
  if (resultCache.has(cacheKey)) {
    return resultCache.get(cacheKey)!;
  }

  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const request = (async () => {
    await waitForRateLimit(signal);
    const result = await fetchNominatim(trimmed, signal);
    resultCache.set(cacheKey, result);
    return result;
  })().finally(() => {
    inFlight.delete(cacheKey);
  });

  inFlight.set(cacheKey, request);
  return request;
}
