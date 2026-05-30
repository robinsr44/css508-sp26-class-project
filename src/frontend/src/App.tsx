import { useMemo, useRef, useState } from "react";
import "./App.css";
import { fetchMoon, fetchSun, type MoonApiResponse, type SunApiResponse } from "./api";
import { formatInstantForDisplay, getPrimaryTimeZone, localWallClockToUtc, utcWallClockToLocal } from "./locationTime";
import MoonPhase from "./MoonPhase";
import { phaseDisplayName } from "./phaseDisplayName";
import { hoursAboveHorizonText } from "./visibilityText";

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function azimuthToCompass(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const normalized = ((deg % 360) + 360) % 360;
  return dirs[Math.round(normalized / 22.5) % 16];
}

export default function App() {
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [locationRequiredHint, setLocationRequiredHint] = useState(false);
  const [resultLocationName, setResultLocationName] = useState<string | null>(null);
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  });
  const [timeUtc, setTimeUtc] = useState(() => {
    const d = new Date();
    return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MoonApiResponse | null>(null);
  const [sunData, setSunData] = useState<SunApiResponse | null>(null);
  const [showGmt, setShowGmt] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationSearching, setLocationSearching] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState<string | null>(null);
  const [resolvedLocationName, setResolvedLocationName] = useState<string | null>(null);
  const locationSearchAbort = useRef<AbortController | null>(null);

  const hasLocationSet = useMemo(() => {
    if (locationQuery.trim()) return true;
    if (resolvedLocationName) return true;
    if (lat.trim() !== "" && lon.trim() !== "") return true;
    return false;
  }, [locationQuery, resolvedLocationName, lat, lon]);

  const canSubmit = useMemo(() => date.trim() !== "", [date]);

  const coords = useMemo(() => {
    if (lat.trim() === "" || lon.trim() === "") return null;
    const la = Number(lat);
    const lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
    return { lat: la, lon: lo };
  }, [lat, lon]);

  const locationTimeZone = useMemo(
    () => (coords ? getPrimaryTimeZone(coords.lat, coords.lon) : null),
    [coords],
  );

  const resultTimeZone = useMemo(() => {
    const loc = data?.location ?? sunData?.location;
    if (loc) return getPrimaryTimeZone(loc.latitude, loc.longitude);
    return locationTimeZone;
  }, [data, sunData, locationTimeZone]);

  const useUtcInput = showGmt || !locationTimeZone;

  const displayDate = useMemo(() => {
    if (useUtcInput) return date;
    const local = utcWallClockToLocal(date, timeUtc, locationTimeZone!);
    return local?.dateLocal ?? date;
  }, [date, timeUtc, useUtcInput, locationTimeZone]);

  const displayTime = useMemo(() => {
    if (useUtcInput) return timeUtc;
    const local = utcWallClockToLocal(date, timeUtc, locationTimeZone!);
    return local?.timeLocal ?? timeUtc;
  }, [date, timeUtc, useUtcInput, locationTimeZone]);

  function onDateChange(nextDate: string) {
    if (useUtcInput) {
      setDate(nextDate);
      return;
    }
    const utc = localWallClockToUtc(nextDate, displayTime, locationTimeZone!);
    if (utc) {
      setDate(utc.dateUtc);
      setTimeUtc(utc.timeUtc);
    } else {
      setDate(nextDate);
    }
  }

  function onTimeChange(nextTime: string) {
    if (useUtcInput) {
      setTimeUtc(nextTime);
      return;
    }
    const utc = localWallClockToUtc(displayDate, nextTime, locationTimeZone!);
    if (utc) {
      setDate(utc.dateUtc);
      setTimeUtc(utc.timeUtc);
    } else {
      setTimeUtc(nextTime);
    }
  }

  function timeZonePill(groupLabel: string) {
    return (
      <div className="tz-pill" role="group" aria-label={groupLabel}>
        <button
          type="button"
          className={`pill-option${!showGmt ? " pill-active" : ""}`}
          aria-pressed={!showGmt}
          onClick={() => setShowGmt(false)}
          disabled={!locationTimeZone}
        >
          Local
        </button>
        <button
          type="button"
          className={`pill-option${showGmt ? " pill-active" : ""}`}
          aria-pressed={showGmt}
          onClick={() => setShowGmt(true)}
        >
          UTC
        </button>
      </div>
    );
  }

  async function resolveLocationQuery(
    q: string,
    signal?: AbortSignal,
  ): Promise<{ lat: number; lon: number; displayName: string } | null> {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      { headers: { Accept: "application/json" }, signal },
    );
    if (!res.ok) throw new Error("Search request failed.");
    const results = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (results.length === 0) return null;
    return {
      lat: parseFloat(results[0].lat),
      lon: parseFloat(results[0].lon),
      displayName: results[0].display_name,
    };
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(4));
        setLon(pos.coords.longitude.toFixed(4));
        setResolvedLocationName("Your location");
        setLocationRequiredHint(false);
        setLocating(false);
      },
      (err) => {
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Location access denied. Please allow location access and try again."
            : "Unable to determine your location.",
        );
        setLocating(false);
      },
    );
  }

  async function searchLocation() {
    const q = locationQuery.trim();
    if (!q) return;
    locationSearchAbort.current?.abort();
    const controller = new AbortController();
    locationSearchAbort.current = controller;
    setLocationSearching(true);
    setLocationSearchError(null);
    setResolvedLocationName(null);
    setGeoError(null);
    try {
      const resolved = await resolveLocationQuery(q, controller.signal);
      if (!resolved) {
        setLocationSearchError(`No results found for "${q}". Try a more specific search.`);
        return;
      }
      setLat(resolved.lat.toFixed(4));
      setLon(resolved.lon.toFixed(4));
      setResolvedLocationName(resolved.displayName);
      setLocationRequiredHint(false);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setLocationSearchError("Search failed. Check your connection or enter coordinates directly.");
    } finally {
      setLocationSearching(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLocationRequiredHint(false);

    if (!hasLocationSet) {
      setLocationRequiredHint(true);
      return;
    }

    setLoading(true);
    setData(null);
    setSunData(null);
    setResultLocationName(null);
    try {
      let latN = Number(lat);
      let lonN = Number(lon);
      let locationName = resolvedLocationName;

      const q = locationQuery.trim();
      if (q) {
        setLocationSearchError(null);
        const resolved = await resolveLocationQuery(q);
        if (!resolved) {
          throw new Error(`No results found for "${q}". Try a more specific search.`);
        }
        latN = resolved.lat;
        lonN = resolved.lon;
        locationName = resolved.displayName;
        setLat(latN.toFixed(4));
        setLon(lonN.toFixed(4));
        setResolvedLocationName(resolved.displayName);
      }

      if (!Number.isFinite(latN) || !Number.isFinite(lonN)) {
        throw new Error("Latitude and longitude must be valid numbers.");
      }

      if (!locationName) {
        locationName = `${latN.toFixed(4)}°, ${lonN.toFixed(4)}°`;
      }

      const [moonRes, sunRes] = await Promise.all([
        fetchMoon({ lat: latN, lon: lonN, date, timeUtc }),
        fetchSun({ lat: latN, lon: lonN, date, timeUtc }),
      ]);
      setData(moonRes);
      setSunData(sunRes);
      setResultLocationName(locationName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Moon tracker</h1>
        <p className="subtitle">
          Enter a location and date to see moon phase, moonrise/moonset times, and sun position.
        </p>
      </header>

      <main className="app-main">
      <form className="card" onSubmit={onSubmit}>
        <div>
          <label htmlFor="location-search">Location</label>
          <div className="location-search-row">
            <input
              id="location-search"
              type="search"
              placeholder="City, e.g. Richmond, VA or Tokyo"
              value={locationQuery}
              onChange={(e) => {
                setLocationQuery(e.target.value);
                setLocationRequiredHint(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void searchLocation();
                }
              }}
            />
            <button
              type="button"
              className="btn-search"
              onClick={() => void searchLocation()}
              disabled={locationSearching || !locationQuery.trim()}
            >
              {locationSearching ? "Searching…" : "Search"}
            </button>
          </div>
          {resolvedLocationName ? (
            <p className="input-hint location-resolved">{resolvedLocationName}</p>
          ) : null}
          {locationSearchError ? (
            <p className="error location-error">{locationSearchError}</p>
          ) : null}
        </div>

        <div className="location-alt-row">
          <button type="button" className="btn-location" onClick={useMyLocation} disabled={locating}>
            {locating ? "Locating…" : "Use my location"}
          </button>
          {geoError ? (
            <p className="error" style={{ marginTop: "0.4rem", marginBottom: 0 }}>
              {geoError}
            </p>
          ) : null}
        </div>

        <div className="coords-divider">
          <span>or enter coordinates</span>
        </div>

        <div className="row">
          <div>
            <label htmlFor="lat">Latitude (°)</label>
            <input
              id="lat"
              inputMode="decimal"
              value={lat}
              onChange={(e) => {
                setLat(e.target.value);
                setLocationRequiredHint(false);
              }}
            />
          </div>
          <div>
            <label htmlFor="lon">Longitude (°)</label>
            <input
              id="lon"
              inputMode="decimal"
              value={lon}
              onChange={(e) => {
                setLon(e.target.value);
                setLocationRequiredHint(false);
              }}
            />
          </div>
        </div>
        <div className="row" style={{ marginTop: "0.75rem" }}>
          <div>
            <label htmlFor="date">Date{useUtcInput ? " (UTC)" : " (local)"}</label>
            <input id="date" type="date" value={displayDate} onChange={(e) => onDateChange(e.target.value)} />
          </div>
          <div>
            <div className="time-input-header">
              <label htmlFor="time">Time{useUtcInput ? " (UTC)" : " (local)"}</label>
              <div className="time-zone-toggle time-zone-toggle--inline">
                <span className="tz-toggle-label">Times</span>
                {timeZonePill("Time entry")}
              </div>
            </div>
            <input id="time" type="time" value={displayTime} onChange={(e) => onTimeChange(e.target.value)} />
            <p className="input-hint">
              {useUtcInput ? "24-hour clock, UTC" : "24-hour clock, destination local time"}
            </p>
          </div>
        </div>
        <button type="submit" disabled={!canSubmit || loading}>
          {loading ? "Computing…" : "Compute"}
        </button>
        {locationRequiredHint ? (
          <p className="muted location-required-hint" role="status">
            Set a location using search, your device location, or coordinates before computing.
          </p>
        ) : null}
        {error ? (
          <div className="error" role="alert">
            {error}
          </div>
        ) : null}
      </form>

      {data || sunData ? (
        <div className="time-zone-toggle">
          <span className="tz-toggle-label">Times</span>
          {timeZonePill("Time display")}
        </div>
      ) : null}

      {data ? (
        <div className="card result-grid">
          <div className="result-location">
            {resultLocationName ? <p className="result-location-name">{resultLocationName}</p> : null}
            <p className="result-location-coords muted">
              {data.location.latitude.toFixed(4)}°, {data.location.longitude.toFixed(4)}°
            </p>
          </div>
          <div className="result-item phase-item">
            {typeof data.phase.cycle_fraction === "number" &&
            typeof data.illumination.fraction === "number" ? (
              <MoonPhase
                cycleFraction={data.phase.cycle_fraction}
                illuminationFraction={data.illumination.fraction}
                illuminationPercent={data.illumination.percent}
                size={80}
              />
            ) : null}
            <div>
              <h2>Phase</h2>
              <p>
                <strong>{phaseDisplayName(data)}</strong>
              </p>
              {typeof data.phase.cycle_fraction === "number" ? (
                <p className="muted">
                  {(data.phase.cycle_fraction * 100).toFixed(1)}% through the current cycle
                </p>
              ) : null}
            </div>
          </div>
          <div className="result-item">
            <h2>Illumination</h2>
            <p>
              <strong>
                {typeof data.illumination.percent === "number"
                  ? `${data.illumination.percent.toFixed(1)}%`
                  : "—"}
              </strong>{" "}
              lit
            </p>
            <p>
              {showGmt ? "UTC" : "Local time"}:{" "}
              <strong>{formatInstantForDisplay(data.instant_utc, showGmt, resultTimeZone)}</strong>
            </p>
          </div>
          <div className="result-item">
            <h2>Visibility</h2>
            {!resultTimeZone ? (
              <p className="muted" style={{ marginTop: 0 }}>
                No timezone found for these coordinates; showing UTC only.
              </p>
            ) : null}
            {data.visibility.state === "normal" ? (
              <>
                {data.visibility.moonrise_utc ? (
                  <p>
                    {showGmt ? "Moonrise (UTC)" : "Moonrise"}:{" "}
                    <strong>
                      {formatInstantForDisplay(data.visibility.moonrise_utc, showGmt, resultTimeZone)}
                    </strong>
                  </p>
                ) : null}
                {data.visibility.moonset_utc ? (
                  <p>
                    {showGmt ? "Moonset (UTC)" : "Moonset"}:{" "}
                    <strong>
                      {formatInstantForDisplay(data.visibility.moonset_utc, showGmt, resultTimeZone)}
                    </strong>
                  </p>
                ) : null}
                {typeof data.visibility.hours_above_horizon === "number" ? (
                  <p className="muted">
                    Above the horizon for {hoursAboveHorizonText(data.visibility.hours_above_horizon)}
                  </p>
                ) : null}
              </>
            ) : data.visibility.state === "always_up" ? (
              <p>The moon is above the horizon all day.</p>
            ) : (
              <p>The moon is below the horizon all day.</p>
            )}
          </div>
        </div>
      ) : null}

      {sunData ? (
        <div className="card result-grid">
          <div className="result-item">
            <h2>Sun position</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              Azimuth and altitude at your selected time.
            </p>
            <p>
              {showGmt ? "UTC" : "Local time"}:{" "}
              <strong>{formatInstantForDisplay(sunData.instant_utc, showGmt, resultTimeZone)}</strong>
            </p>
            <p>
              Direction:{" "}
              <strong>
                {typeof sunData.position.azimuth_deg === "number"
                  ? `${azimuthToCompass(sunData.position.azimuth_deg)} (${sunData.position.azimuth_deg.toFixed(1)}°)`
                  : "—"}
              </strong>
            </p>
            <p>
              Altitude:{" "}
              <strong>
                {typeof sunData.position.altitude_deg === "number"
                  ? `${sunData.position.altitude_deg.toFixed(1)}°`
                  : "—"}
              </strong>
            </p>
          </div>
        </div>
      ) : null}
      </main>
    </div>
  );
}
