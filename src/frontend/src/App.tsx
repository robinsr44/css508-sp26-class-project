import { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
  fetchMoon,
  fetchSun,
  fetchVersion,
  type MoonApiResponse,
  type SunApiResponse,
  type VersionApiResponse,
} from "./api";
import { formatUtcIsoInZone, getPrimaryTimeZone } from "./locationTime";

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

export default function App() {
  const [lat, setLat] = useState("47.6062");
  const [lon, setLon] = useState("-122.3321");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  });
  const [timeUtc, setTimeUtc] = useState("12:00");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MoonApiResponse | null>(null);
  const [sunData, setSunData] = useState<SunApiResponse | null>(null);
  const [version, setVersion] = useState<VersionApiResponse | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return lat.trim() !== "" && lon.trim() !== "" && date.trim() !== "";
  }, [lat, lon, date]);

  const coords = useMemo(() => {
    const la = Number(lat);
    const lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
    return { lat: la, lon: lo };
  }, [lat, lon]);

  const locationTimeZone = useMemo(
    () => (coords ? getPrimaryTimeZone(coords.lat, coords.lon) : null),
    [coords],
  );

  const queryParams = useMemo(() => {
    const q = new URLSearchParams({
      lat: lat.trim(),
      lon: lon.trim(),
      date: date.trim(),
      time: timeUtc.trim(),
    });
    return q.toString();
  }, [lat, lon, date, timeUtc]);

  const moonGetUrl = useMemo(() => {
    if (typeof window === "undefined") return `/api/moon?${queryParams}`;
    return new URL(`/api/moon?${queryParams}`, window.location.origin).href;
  }, [queryParams]);

  const sunGetUrl = useMemo(() => {
    if (typeof window === "undefined") return `/api/sun?${queryParams}`;
    return new URL(`/api/sun?${queryParams}`, window.location.origin).href;
  }, [queryParams]);

  const versionUrl = useMemo(() => {
    if (typeof window === "undefined") return "/api/version";
    return new URL("/api/version", window.location.origin).href;
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchVersion()
      .then((v) => {
        if (!cancelled) setVersion(v);
      })
      .catch(() => {
        if (!cancelled) setVersion(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function copyToClipboard(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(label);
      window.setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      setCopyFeedback("Copy failed");
      window.setTimeout(() => setCopyFeedback(null), 2000);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setData(null);
    setSunData(null);
    try {
      const latN = Number(lat);
      const lonN = Number(lon);
      if (!Number.isFinite(latN) || !Number.isFinite(lonN)) {
        throw new Error("Latitude and longitude must be valid numbers.");
      }
      const [moonRes, sunRes] = await Promise.all([
        fetchMoon({ lat: latN, lon: lonN, date, timeUtc }),
        fetchSun({ lat: latN, lon: lonN, date, timeUtc }),
      ]);
      setData(moonRes);
      setSunData(sunRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  const copyStatusMessage =
    copyFeedback === "moon"
      ? "Moon API URL copied to clipboard."
      : copyFeedback === "sun"
        ? "Sun API URL copied to clipboard."
        : copyFeedback === "version"
          ? "Version API URL copied to clipboard."
          : copyFeedback === "Copy failed"
            ? "Copy failed."
            : null;

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <main id="main-content">
      <h1>Moon tracker</h1>
      <p className="subtitle">
        Phase, illumination, and moonrise/moonset for a place and date, plus sun azimuth and altitude at your instant.
        Enter the
        observation time in <strong>UTC</strong>. Results show <strong>local time at your coordinates</strong> (IANA
        timezone from a geographic lookup), with UTC in smaller text. The API still computes in UTC.
      </p>

      <details className="disclaimer">
        <summary className="disclaimer-summary">
          Disclaimer — estimates only; not for navigation or safety decisions
        </summary>
        <div className="disclaimer-body">
          <p>
            Moon and sun times shown here are <strong>estimates for learning and general interest</strong>. They use a
            low-precision astronomical model with a clear-sky assumption (no weather or atmospheric effects).
          </p>
          <p>
            <strong>Do not use this app for navigation, safety decisions, or mission planning.</strong> Verify important
            times with official almanacs or other trusted sources. Data is provided <strong>as is</strong>, without
            warranty; you use it at your own risk.
          </p>
        </div>
      </details>

      {version ? (
        <p className="muted" style={{ marginTop: "-0.75rem", marginBottom: "1.25rem" }}>
          API <code className="inline-code">{version.service}</code> version{" "}
          <code className="inline-code">{version.version}</code>
        </p>
      ) : null}

      <p id="form-hint" className="sr-only">
        Enter latitude, longitude, date, and optional UTC time, then choose Compute. Results appear below the form.
      </p>

      <form className="card" onSubmit={onSubmit} aria-describedby="form-hint" aria-busy={loading}>
        <div className="row">
          <div>
            <label htmlFor="lat">Latitude (°)</label>
            <input id="lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
          </div>
          <div>
            <label htmlFor="lon">Longitude (°)</label>
            <input id="lon" inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} />
          </div>
        </div>
        <div className="row" style={{ marginTop: "0.75rem" }}>
          <div>
            <label htmlFor="date">Date</label>
            <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="time">Time (UTC)</label>
            <input id="time" type="time" value={timeUtc} onChange={(e) => setTimeUtc(e.target.value)} />
          </div>
        </div>
        <button type="submit" disabled={!canSubmit || loading} aria-disabled={!canSubmit || loading}>
          {loading ? "Computing…" : "Compute"}
        </button>
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {loading ? "Loading moon and sun data." : ""}
        </p>
        {!canSubmit ? (
          <p id="form-required-hint" className="muted" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
            Fill in latitude, longitude, and date to compute.
          </p>
        ) : null}
        {error ? (
          <div className="error" role="alert">
            {error}
          </div>
        ) : null}
      </form>

      {canSubmit ? (
        <details className="card api-direct">
          <summary className="api-direct-summary">Query the API directly</summary>
          <div className="api-direct-body">
          <p className="muted" style={{ marginTop: 0 }}>
            Same parameters as the form: <code className="inline-code">GET</code> with query string, or{" "}
            <code className="inline-code">POST</code> with JSON. Copy a URL and open it in a browser, or use{" "}
            <code className="inline-code">curl</code>.
          </p>
          <div className="api-url-row">
            <div>
              <span className="api-label">Moon</span>
              <code className="api-url">{moonGetUrl}</code>
            </div>
            <button
              type="button"
              className="btn-secondary"
              aria-label="Copy Moon API URL"
              onClick={() => void copyToClipboard("moon", moonGetUrl)}
            >
              {copyFeedback === "moon" ? "Copied" : "Copy URL"}
            </button>
          </div>
          <div className="api-url-row">
            <div>
              <span className="api-label">Sun</span>
              <code className="api-url">{sunGetUrl}</code>
            </div>
            <button
              type="button"
              className="btn-secondary"
              aria-label="Copy Sun API URL"
              onClick={() => void copyToClipboard("sun", sunGetUrl)}
            >
              {copyFeedback === "sun" ? "Copied" : "Copy URL"}
            </button>
          </div>
          <div className="api-url-row">
            <div>
              <span className="api-label">Version</span>
              <code className="api-url">{versionUrl}</code>
            </div>
            <button
              type="button"
              className="btn-secondary"
              aria-label="Copy version API URL"
              onClick={() => void copyToClipboard("version", versionUrl)}
            >
              {copyFeedback === "version" ? "Copied" : "Copy URL"}
            </button>
          </div>
          {copyStatusMessage ? (
            <p className="sr-only" role="status" aria-live="polite">
              {copyStatusMessage}
            </p>
          ) : null}
          <details className="curl-details">
            <summary>Example curl commands</summary>
            <pre className="api-pre">
              {`curl -s "${moonGetUrl}"
curl -s "${sunGetUrl}"
curl -s "${versionUrl}"`}
            </pre>
          </details>
          </div>
        </details>
      ) : null}

      {data ? (
        <section className="card result-grid" aria-labelledby="moon-results-heading" aria-live="polite">
          <h2 id="moon-results-heading" className="results-section-title">
            Moon results
          </h2>
          <div className="result-item">
            <h3>Phase</h3>
            <p>
              <strong>{data.phase.name}</strong>
            </p>
            <p className="muted">
              Cycle fraction:{" "}
              {typeof data.phase.cycle_fraction === "number"
                ? data.phase.cycle_fraction.toFixed(4)
                : "—"}
            </p>
            <p className="muted">
              Sun–Moon–Earth angle:{" "}
              {typeof data.phase.sun_moon_earth_angle_deg === "number"
                ? `${data.phase.sun_moon_earth_angle_deg.toFixed(2)}°`
                : "—"}
            </p>
          </div>
          <div className="result-item">
            <h3>Illumination</h3>
            <p>
              <strong>
                {typeof data.illumination.percent === "number"
                  ? `${data.illumination.percent.toFixed(1)}%`
                  : "—"}
              </strong>{" "}
              lit
            </p>
            {locationTimeZone ? (
              <>
                <p>
                  Instant (local): <strong>{formatUtcIsoInZone(data.instant_utc, locationTimeZone)}</strong>
                </p>
                <p className="muted">Instant (UTC): {data.instant_utc}</p>
              </>
            ) : (
              <p className="muted">Instant (UTC): {data.instant_utc}</p>
            )}
          </div>
          <div className="result-item">
            <h3>Visibility</h3>
            {locationTimeZone ? (
              <p className="muted" style={{ marginTop: 0 }}>
                Timezone: <code>{locationTimeZone}</code>. Rise/set from the API use the UTC calendar day of your selected
                date.
              </p>
            ) : (
              <p className="muted" style={{ marginTop: 0 }}>
                No timezone found for these coordinates; showing UTC only.
              </p>
            )}
            {data.visibility.state === "normal" ? (
              <>
                {data.visibility.moonrise_utc ? (
                  <p>
                    Moonrise (local):{" "}
                    <strong>
                      {locationTimeZone
                        ? formatUtcIsoInZone(data.visibility.moonrise_utc, locationTimeZone)
                        : data.visibility.moonrise_utc}
                    </strong>
                  </p>
                ) : null}
                {data.visibility.moonset_utc ? (
                  <p>
                    Moonset (local):{" "}
                    <strong>
                      {locationTimeZone
                        ? formatUtcIsoInZone(data.visibility.moonset_utc, locationTimeZone)
                        : data.visibility.moonset_utc}
                    </strong>
                  </p>
                ) : null}
                {(data.visibility.moonrise_utc || data.visibility.moonset_utc) && locationTimeZone ? (
                  <p className="muted">
                    UTC: moonrise {data.visibility.moonrise_utc ?? "—"}, moonset {data.visibility.moonset_utc ?? "—"}
                  </p>
                ) : null}
                {typeof data.visibility.hours_above_horizon === "number" ? (
                  <p className="muted">Hours above horizon: {data.visibility.hours_above_horizon.toFixed(2)}</p>
                ) : null}
              </>
            ) : data.visibility.state === "always_up" ? (
              <p>Moon continuously above horizon that day (polar / high-latitude case).</p>
            ) : (
              <p>Moon continuously below horizon that day.</p>
            )}
          </div>
        </section>
      ) : null}

      {sunData ? (
        <section className="card result-grid" aria-labelledby="sun-results-heading">
          <h2 id="sun-results-heading" className="results-section-title">
            Sun results
          </h2>
          <div className="result-item">
            <h3>Sun position</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Azimuth and altitude at your selected UTC instant (0° altitude ≈ horizon; low-precision suncalc-style model).
            </p>
            {locationTimeZone ? (
              <p>
                Instant (local): <strong>{formatUtcIsoInZone(sunData.instant_utc, locationTimeZone)}</strong>
              </p>
            ) : null}
            <p className="muted">Instant (UTC): {sunData.instant_utc}</p>
            <p>
              Azimuth:{" "}
              <strong>
                {typeof sunData.position.azimuth_deg === "number"
                  ? `${sunData.position.azimuth_deg.toFixed(2)}°`
                  : "—"}
              </strong>
            </p>
            <p>
              Altitude:{" "}
              <strong>
                {typeof sunData.position.altitude_deg === "number"
                  ? `${sunData.position.altitude_deg.toFixed(2)}°`
                  : "—"}
              </strong>
            </p>
          </div>
        </section>
      ) : null}

      {data && sunData ? (
        <div className="card">
          <label className="raw-toggle">
            <input type="checkbox" checked={showRawJson} onChange={(e) => setShowRawJson(e.target.checked)} />
            Show raw JSON from the API
          </label>
          {showRawJson ? (
            <div className="raw-json-grid">
              <div>
                <h3 className="raw-json-heading">GET /api/moon</h3>
                <pre className="api-pre">{JSON.stringify(data, null, 2)}</pre>
              </div>
              <div>
                <h3 className="raw-json-heading">GET /api/sun</h3>
                <pre className="api-pre">{JSON.stringify(sunData, null, 2)}</pre>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      </main>
    </div>
  );
}
