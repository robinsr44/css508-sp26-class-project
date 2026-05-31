import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { fetchMoon, fetchSun, type MoonApiResponse, type SunApiResponse } from "./api";
import {
  formatInstantForDisplay,
  getPrimaryTimeZone,
  localCivilDayUtcBounds,
  localWallClockToUtc,
  utcCalendarDayBounds,
  utcWallClockToLocal,
} from "./locationTime";
import { searchNominatim } from "./nominatim";
import MoonPhase from "./MoonPhase";
import TimeInput24 from "./TimeInput24";
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
  const prevLoadingRef = useRef(false);
  const [liveMessage, setLiveMessage] = useState("");

  useEffect(() => {
    if (loading) {
      setLiveMessage("Computing moon and sun data.");
    } else if (prevLoadingRef.current && data && sunData) {
      setLiveMessage("Moon and sun results are ready.");
    }
    prevLoadingRef.current = loading;
  }, [loading, data, sunData]);

  useEffect(() => {
    if (locationSearching) {
      setLiveMessage("Searching for location.");
    }
  }, [locationSearching]);

  useEffect(() => {
    if (locating) {
      setLiveMessage("Determining your device location.");
    }
  }, [locating]);

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
      const resolved = await searchNominatim(q, controller.signal);
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
        const resolved = await searchNominatim(q);
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

      const tz = getPrimaryTimeZone(latN, lonN);
      const useUtcForVisibility = showGmt || !tz;
      const visibilityWindow = useUtcForVisibility
        ? utcCalendarDayBounds(date)
        : localCivilDayUtcBounds(displayDate, tz);

      const [moonRes, sunRes] = await Promise.all([
        fetchMoon({
          lat: latN,
          lon: lonN,
          date,
          timeUtc,
          visibilityWindow: visibilityWindow ?? undefined,
        }),
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
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>
      <header className="app-header">
        <h1>Moon tracker</h1>
        <p className="subtitle">
          Enter a location and date to see moon phase, moonrise/moonset times, and sun position.
        </p>
        <p id="navigation-disclaimer" className="navigation-disclaimer" role="note">
          <strong>Not for navigation.</strong> Moon and sun data are approximate estimates for
          recreational interest only—not for aviation, maritime, driving, hiking, or other
          safety-critical use.
        </p>
        <details className="disclaimer" aria-labelledby="disclaimer-summary">
          <summary id="disclaimer-summary">Full disclaimer</summary>
          <div className="disclaimer-body" aria-labelledby="disclaimer-summary">
            <p>
              <strong>Information for recreational purposes only.</strong> Moon phase, rise/set times,
              and sun position shown here are estimates intended for general interest and casual
              planning. They are not certified, verified, or suitable for any purpose requiring
              precision.
            </p>
            <p>
              <strong>Not for navigation or safety-related use.</strong> Do not rely on this tool for
              aviation, maritime, driving, hiking, emergency response, astronomical observation, or
              any activity where inaccurate timing or position could cause harm, property damage, or
              regulatory non-compliance. This application is not a substitute for official almanacs,
              nautical or aeronautical publications, government observatories, or other authoritative
              sources.
            </p>
            <p>
              <strong>No warranty.</strong> All content is provided &ldquo;as is&rdquo; and &ldquo;as
              available,&rdquo; without warranties of any kind, whether express or implied, including
              but not limited to accuracy, completeness, timeliness, or fitness for a particular
              purpose.
            </p>
            <p>
              <strong>Limitation of liability.</strong> To the fullest extent permitted by applicable
              law, the operators of this tool disclaim all liability for any loss, injury, damage, or
              adverse outcome arising from your use of or reliance on the information displayed.
            </p>
            <p>
              <strong>Your responsibility.</strong> You are solely responsible for independently
              confirming any information before acting on it and for complying with all applicable
              laws, regulations, and safety requirements.
            </p>
          </div>
        </details>
      </header>

      <main id="main-content" className="app-main" tabIndex={-1}>
      <form
        className="card"
        onSubmit={onSubmit}
        aria-busy={loading}
        aria-describedby={locationRequiredHint ? "location-required-hint" : undefined}
      >
        <div>
          <label htmlFor="location-search">Location</label>
          <div className="location-search-row">
            <input
              id="location-search"
              type="search"
              placeholder="City, e.g. Richmond, VA or Tokyo"
              aria-describedby={
                [
                  "location-search-hint",
                  "location-search-attribution",
                  resolvedLocationName ? "location-resolved-hint" : null,
                  locationSearchError ? "location-search-error" : null,
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
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
          <p id="location-search-hint" className="input-hint">
            Search by city or place name, or enter coordinates below.
          </p>
          <p id="location-search-attribution" className="input-hint location-attribution">
            Location search ©{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenStreetMap
            </a>{" "}
            contributors, via{" "}
            <a href="https://nominatim.org/" target="_blank" rel="noopener noreferrer">
              Nominatim
            </a>
            .
          </p>
          {resolvedLocationName ? (
            <p id="location-resolved-hint" className="input-hint location-resolved" role="status">
              {resolvedLocationName}
            </p>
          ) : null}
          {locationSearchError ? (
            <p id="location-search-error" className="error location-error" role="alert">
              {locationSearchError}
            </p>
          ) : null}
        </div>

        <div className="location-alt-row">
          <button type="button" className="btn-location" onClick={useMyLocation} disabled={locating}>
            {locating ? "Locating…" : "Use my location"}
          </button>
          {geoError ? (
            <p className="error" role="alert" style={{ marginTop: "0.4rem", marginBottom: 0 }}>
              {geoError}
            </p>
          ) : null}
        </div>

        <div className="coords-divider" role="separator" aria-label="or enter coordinates">
          <span aria-hidden="true">or enter coordinates</span>
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
            <TimeInput24
              id="time"
              value={displayTime}
              aria-describedby="time-format-hint"
              onChange={onTimeChange}
            />
            <p id="time-format-hint" className="input-hint">
              {useUtcInput ? "24-hour clock, UTC" : "24-hour clock, destination local time"}
            </p>
          </div>
        </div>
        <button type="submit" disabled={!canSubmit || loading} aria-disabled={!canSubmit || loading}>
          {loading ? "Computing…" : "Compute"}
        </button>
        {locationRequiredHint ? (
          <p id="location-required-hint" className="muted location-required-hint" role="status">
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
        <section className="card result-grid" aria-labelledby="moon-results-heading">
          <h2 id="moon-results-heading" className="visually-hidden">
            Moon results
          </h2>
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
            {resultTimeZone && !showGmt ? (
              <p className="muted" style={{ marginTop: 0 }}>
                Moonrise and moonset are for the selected local calendar day at this location.
              </p>
            ) : null}
            {!resultTimeZone ? (
              <p className="muted" style={{ marginTop: 0 }}>
                No timezone found for these coordinates; rise and set use the UTC calendar day.
              </p>
            ) : showGmt ? (
              <p className="muted" style={{ marginTop: 0 }}>
                Moonrise and moonset are for the selected UTC calendar day.
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
        </section>
      ) : null}

      {sunData ? (
        <section className="card result-grid" aria-labelledby="sun-results-heading">
          <h2 id="sun-results-heading" className="visually-hidden">
            Sun results
          </h2>
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
        </section>
      ) : null}

      <footer className="app-footer">
        <h2>Accessibility</h2>
        <p>
          This application is designed to conform with{" "}
          <a
            href="https://www.w3.org/WAI/standards-guidelines/wcag/"
            target="_blank"
            rel="noopener noreferrer"
          >
            WCAG 2.1 Level AA
          </a>{" "}
          and{" "}
          <a
            href="https://www.section508.gov/manage/laws-and-policies/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Section 508
          </a>{" "}
          digital accessibility requirements. It supports keyboard navigation, visible focus
          indicators, screen-reader announcements for status updates, and reduced-motion preferences.
        </p>
        <p>
          If you encounter an accessibility barrier, please contact the course team or open an issue
          in the project repository with a description of the problem and the assistive technology
          you are using.
        </p>
        <h2>Attribution</h2>
        <p>
          Place-name search uses{" "}
          <a href="https://nominatim.org/" target="_blank" rel="noopener noreferrer">
            Nominatim
          </a>{" "}
          and{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenStreetMap
          </a>{" "}
          data (© OpenStreetMap contributors, ODbL).
        </p>
        <p>
          Moon and sun calculations are adapted from{" "}
          <a href="https://github.com/mourner/suncalc" target="_blank" rel="noopener noreferrer">
            SunCalc
          </a>{" "}
          (BSD-2-Clause, © 2011–2015 Vladimir Agafonkin). Results are approximate and for
          recreational use only — not for navigation or safety-critical decisions.
        </p>
      </footer>
      </main>
    </div>
  );
}
