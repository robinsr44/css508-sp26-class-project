import { useMemo, useState } from "react";
import "./App.css";
import { fetchMoon, type MoonApiResponse } from "./api";
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setData(null);
    try {
      const latN = Number(lat);
      const lonN = Number(lon);
      if (!Number.isFinite(latN) || !Number.isFinite(lonN)) {
        throw new Error("Latitude and longitude must be valid numbers.");
      }
      const res = await fetchMoon({ lat: latN, lon: lonN, date, timeUtc });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <h1>Moon tracker</h1>
      <p className="subtitle">
        Phase, illumination, and moonrise/moonset for a place and date. Enter the observation time in <strong>UTC</strong>.
        Results show <strong>local time at your coordinates</strong> (IANA timezone from a geographic lookup), with UTC in
        smaller text. The API still computes in UTC.
      </p>

      <form className="card" onSubmit={onSubmit}>
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
        <button type="submit" disabled={!canSubmit || loading}>
          {loading ? "Computing…" : "Compute"}
        </button>
        {!canSubmit ? (
          <p className="muted" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
            Fill in latitude, longitude, and date to compute.
          </p>
        ) : null}
        {error ? (
          <div className="error" role="alert">
            {error}
          </div>
        ) : null}
      </form>

      {data ? (
        <div className="card result-grid">
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
        </div>
      ) : null}
    </div>
  );
}
