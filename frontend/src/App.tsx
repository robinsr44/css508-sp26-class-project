import { useMemo, useState } from "react";
import "./App.css";
import { fetchMoon, type MoonApiResponse } from "./api";

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
        Phase, illumination, and moonrise/moonset for a place and date. Times use UTC unless noted; the API uses UTC
        for the selected instant and for rise/set on the UTC calendar day.
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
        {error ? <div className="error">{error}</div> : null}
      </form>

      {data ? (
        <div className="card result-grid">
          <div className="result-item">
            <h3>Phase</h3>
            <p>
              <strong>{data.phase.name}</strong>
            </p>
            <p className="muted">Cycle fraction: {data.phase.cycle_fraction.toFixed(4)}</p>
            <p className="muted">Sun–Moon–Earth angle: {data.phase.sun_moon_earth_angle_deg.toFixed(2)}°</p>
          </div>
          <div className="result-item">
            <h3>Illumination</h3>
            <p>
              <strong>{data.illumination.percent.toFixed(1)}%</strong> lit
            </p>
            <p className="muted">Instant (UTC): {data.instant_utc}</p>
          </div>
          <div className="result-item">
            <h3>Visibility (UTC day)</h3>
            {data.visibility.state === "normal" ? (
              <>
                {data.visibility.moonrise_utc ? (
                  <p>
                    Moonrise: <strong>{data.visibility.moonrise_utc}</strong>
                  </p>
                ) : null}
                {data.visibility.moonset_utc ? (
                  <p>
                    Moonset: <strong>{data.visibility.moonset_utc}</strong>
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
            <p className="muted">Rise/set are computed for the UTC calendar day of the selected date.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
