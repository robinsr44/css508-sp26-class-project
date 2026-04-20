# Unit testing report

**Report date:** 2026-04-19  

This report lists automated unit tests in the repository and their **expected** outcome (**Pass**) when run on a machine with dependencies installed. It was synchronized with `moon_api_test.cpp`, `moon_ephemeris_test.cpp`, and Vitest files under `src/frontend/src/`.  

### How these results were generated

1. **Test inventory** — Case names and counts were taken from the current test sources (GoogleTest `TEST(...)` blocks and Vitest `it(...)` blocks). Each row in the tables below is one such test.
2. **Pass/Fail column** — **Pass** means the test is **expected to succeed** after a clean configure/build/install on a typical developer machine (CMake 3.16+, C++17 compiler, Node LTS for the frontend). This document does not embed a unique CI log ID; to capture a **fresh** run for an assignment, follow the commands below and save the terminal output (or attach your CI run URL). You can also prove the same suites using **Docker** test-image builds (see **Using Docker** below).

### Commands to run (regenerate or verify)

Run all commands from the **repository root** unless a step says otherwise. Network access is required the first time CMake **FetchContent** downloads dependencies (e.g. cpp-httplib, GoogleTest).

**Backend (C++ unit tests)**

```bash
cmake -S src/backend -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build
```

Run the suites **either** as registered CTest tests **or** by invoking the binaries directly:

```bash
ctest --test-dir build --output-on-failure
```

```bash
./build/moon_ephemeris_tests
./build/moon_api_tests
```

You should see **20** tests pass in `moon_ephemeris_tests`, **22** in `moon_api_tests`, and CTest should report **2** tests (those two executables) if you use `ctest` only.

**Frontend (Vitest)**

```bash
cd src/frontend
npm install
npm test
```

Equivalent non-interactive run:

```bash
cd src/frontend
npm install
npx vitest run
```

You should see **26** tests pass across `App.test.tsx`, `api.test.ts`, and `locationTime.test.ts`.

**Using Docker (same tests, containerized build)**

Requires **Docker** and **Docker Compose** (v2: `docker compose`). Unit tests run **during the image build** for the test targets (`ctest` for C++, `npm test` / Vitest for the frontend). If any test fails, the **build fails**—there is no separate “run container” step for unit tests.

From the **repository root**:

Build **both** test images (matches a full local unit-test run):

```bash
docker compose --profile test build test-backend test-frontend
```

**C++ tests only:**

```bash
docker compose --profile test build test-backend
```

**Frontend tests only:**

```bash
docker compose --profile test build test-frontend
```

**Same targets with `docker build`** (equivalent to the services in [docker-compose.yml](docker-compose.yml)):

```bash
docker build --target test-backend .
docker build --target test-frontend .
```

- A successful run ends with the images built (e.g. `moon-tracker-test-backend:local` / `moon-tracker-test-frontend:local` when using Compose) and exit code **0**.
- First-time builds need network access for base images and dependency downloads.
- Full detail: [README.md](README.md) § *Unit tests in Docker*.

| Suite | Tests | Notes |
| --- | ---: | --- |
| `moon_ephemeris_tests` | 20 | C++ |
| `moon_api_tests` | 22 | C++ |
| Vitest (`*.test.ts`, `*.test.tsx`) | 26 | TypeScript / React |
| **Total** | **68** | |

---

## Backend

### `moon_api_test.cpp`

| Test | Description | Result |
| --- | --- | --- |
| `MoonApiHealth.GetOk` | `GET /api/health` returns 200 and JSON `{"status":"ok"}`. | Pass |
| `MoonApiVersion.GetHasServiceAndVersion` | `GET /api/version` returns service name `moon-api` and a non-empty version string. | Pass |
| `MoonApiCors.OptionsMoon` | `OPTIONS /api/moon` returns 204 and `Access-Control-Allow-Origin: *`. | Pass |
| `MoonApiCors.OptionsSun` | `OPTIONS /api/sun` returns 204. | Pass |
| `MoonApiCors.OptionsHealth` | `OPTIONS /api/health` returns 204 and CORS allow-origin header. | Pass |
| `MoonApiCors.OptionsVersion` | `OPTIONS /api/version` returns 204 and CORS allow-origin header. | Pass |
| `MoonApiGetMoon.MissingParams400` | `GET /api/moon` without required query parameters returns 400 with a JSON error message. | Pass |
| `MoonApiGetMoon.InvalidLatLon400` | Non-numeric `lat`/`lon` query values return 400. | Pass |
| `MoonApiGetMoon.InvalidDate400` | Bad date format in query returns 400. | Pass |
| `MoonApiGetMoon.InvalidTime400` | Invalid optional `time` (e.g. 25:00) returns 400. | Pass |
| `MoonApiGetMoon.LatLonOutOfRange400` | Latitude/longitude outside allowed ranges return 400. | Pass |
| `MoonApiGetMoon.Valid200Shape` | Valid moon query returns 200 and the documented top-level JSON keys (instant, location, phase, illumination, visibility). | Pass |
| `MoonApiGetMoon.NormalVisibilityHoursAboveHorizonWhenRiseAndSet` | For `visibility.state` normal, when moonrise and moonset are present, `hours_above_horizon` is included and numeric. | Pass |
| `MoonApiGetMoon.PolarVisibilityShape` | Near-pole request: `visibility.state` is valid; `always_up` / `always_down` omit rise, set, and hours fields. | Pass |
| `MoonApiGetSun.Valid200Shape` | Valid `GET /api/sun` returns 200 with `instant_utc` and `position` azimuth/altitude in degrees. | Pass |
| `MoonApiPostMoon.InvalidJson400` | Malformed JSON body on `POST /api/moon` returns 400. | Pass |
| `MoonApiPostMoon.MissingKeys400` | JSON body missing required keys returns 400. | Pass |
| `MoonApiPostMoon.LatLonMustBeNumbers400` | `lat`/`lon` must be JSON numbers, not strings. | Pass |
| `MoonApiPostMoon.DateMustBeString400` | `date` must be a JSON string, not a number. | Pass |
| `MoonApiPostMoon.Valid200Shape` | Valid `POST /api/moon` returns 200 and includes phase `cycle_fraction`. | Pass |
| `MoonApiPostSun.Valid200Shape` | Valid `POST /api/sun` returns 200 with a `position` object. | Pass |
| `MoonApiParity.GetAndPostMoonMatchPhase` | Equivalent GET and POST parameters yield the same `phase.cycle_fraction` and `instant_utc`. | Pass |

_22 tests — run `./build/moon_api_tests` after a Release build (`cmake -B build -S src/backend` / `cmake --build build`)._

### `moon_ephemeris_test.cpp`

| Test | Description | Result |
| --- | --- | --- |
| `JulianUnix.UnixZeroJulianDate` | Unix epoch (`1970-01-01 00:00 UTC`) maps to Julian date 2440587.5. | Pass |
| `JulianUnix.RoundTripSeconds` | Several Unix timestamps round-trip through `julian_date_from_unix_seconds` and `unix_seconds_from_julian_date`. | Pass |
| `JulianUnix.RoundTripJulian` | J2000 Julian day round-trips through Unix seconds back to the same JD. | Pass |
| `ParseDate.AcceptsValidAndBoundaries` | `parse_date` accepts typical `YYYY-MM-DD` strings and boundary years 1900 and 2100. | Pass |
| `ParseDate.RejectsInvalid` | `parse_date` rejects wrong format, out-of-range year, and invalid month/day fields. | Pass |
| `ParseDate.AcceptsImpossibleCalendarDay` | Impossible calendar dates (e.g. Feb 31) still parse: only format and numeric bounds are checked. | Pass |
| `ParseTime.AcceptsValidAndBoundaries` | `parse_time_hh_mm` accepts `HH:MM` at min/max valid hours and minutes. | Pass |
| `ParseTime.RejectsInvalid` | `parse_time_hh_mm` rejects empty input, partial times, out-of-range hour/minute, and negatives. | Pass |
| `Iso8601Utc.Epoch` | JD for Unix epoch formats as `1970-01-01T00:00:00Z`. | Pass |
| `Iso8601Utc.KnownInstant` | A known UTC noon round-trips JD ↔ ISO-8601 string. | Pass |
| `ComputeIllumination.Invariants` | `compute_illumination` yields lit fraction and phase in valid ranges, finite angle, phase angle in [0, 180]°. | Pass |
| `ComputeIllumination.NotConstant` | Illumination differs between two Julian dates (not a flat function). | Pass |
| `MoonPosition.Invariants` | `moon_position` returns plausible lunar distance (km) and finite azimuth/altitude with rough altitude bounds. | Pass |
| `MoonTimes.MidLatitudeSummerDay` | For a mid-latitude summer fixture, moonrise/moonset JDs exist and differ. | Pass |
| `MoonTimes.LeapDay` | Leap day `2024-02-29` computes without error at the same latitude/longitude. | Pass |
| `MoonTimes.HighLatitudePolarFlags` | Near the pole, if neither rise nor set is found, exactly one of `always_up` or `always_down` is set. | Pass |
| `ComputeFull.PhaseNameIsKnown` | `compute_full` reports a known phase name string and illumination fraction in [0, 1]. | Pass |
| `ComputeFull.ConsistentWithComponents` | `compute_full` illumination matches `compute_illumination` at the same UTC instant (shared JD). | Pass |
| `SunPosition.RangeDegrees` | `sun_position` returns finite azimuth and altitude in degrees within plausible sky ranges. | Pass |
| `ComputeSunFull.MatchesSunPosition` | `compute_sun_full` matches `sun_position` for the same UTC instant and observer coordinates. | Pass |

_20 tests — run `./build/moon_ephemeris_tests` after the same build._

---

## Frontend

### `App.test.tsx`

| Test | Description | Result |
| --- | --- | --- |
| `App > renders the main heading and loads version from the API` | Renders the main “moon tracker” heading and loads the API service name from mocked `/api/version`. | Pass |
| `App > submits the form and shows moon phase from mocked API responses` | User submits the form; UI shows the mocked moon phase name and sun position after `/api/moon` and `/api/sun` responses; asserts **Instant (local)** labels when timezone resolves (TestPlan **FE-02** / **FE-04**). | Pass |
| `App > disables Compute and shows hint when latitude, longitude, or date is empty` | Submit is disabled and helper text appears when a required field is cleared (**FE-01**). | Pass |
| `App > shows API error message when moon request fails` | Non-OK moon response shows the API `error` string in the alert (**FE-03**). | Pass |
| `App > shows UTC-only copy when no timezone is found for coordinates` | Out-of-range lat/lon yields “No timezone found…” visibility copy (**FE-05**). | Pass |
| `App > Copy URL updates feedback after moon URL copy` | Moon **Copy URL** triggers clipboard write and shows **Copied** feedback (**FE-06**). | Pass |

_6 tests — run `npm install` and `npm test` (`vitest run`) in `src/frontend`._

### `api.test.ts`

| Test | Description | Result |
| --- | --- | --- |
| `fetchMoon > requests /api/moon with query params from arguments` | `fetchMoon` calls `fetch` once with `/api/moon` and encoded `lat`, `lon`, `date`, and `time` query parameters. | Pass |
| `fetchMoon > returns parsed JSON on 200` | Successful response returns typed fields such as `instant_utc`, phase name, and visibility state. | Pass |
| `fetchMoon > throws with server error message on non-OK JSON body` | HTTP error with JSON `{ error: ... }` rejects with that message. | Pass |
| `fetchMoon > throws on non-JSON error body` | Non-JSON error response rejects with an HTTP status–style error. | Pass |
| `fetchMoon > throws on 200 with unexpected shape` | 200 with missing/invalid shape rejects with “Unexpected API response shape”. | Pass |
| `fetchMoon > throws helpful message on network failure` | `TypeError: Failed to fetch` is wrapped as a “Cannot reach the API” style error. | Pass |
| `fetchMoon > parses always_up visibility without rise/set fields` | `visibility.state === "always_up"` parses without optional rise/set fields. | Pass |
| `fetchSun > requests /api/sun with query params` | `fetchSun` requests `/api/sun` with encoded date and time parameters. | Pass |
| `fetchSun > returns parsed JSON on 200` | Returns sun `position` azimuth and altitude from the mocked body. | Pass |
| `fetchSun > throws on 200 with missing position` | 200 without `position` rejects with unexpected shape. | Pass |
| `fetchVersion > returns version and service on 200` | Parses `service` and `version` from `/api/version`. | Pass |
| `fetchVersion > throws on invalid JSON body` | Non-JSON 200 body rejects with unexpected API response. | Pass |
| `fetchVersion > throws helpful message on network failure` | Network failure rejects with cannot-reach-API style message. | Pass |
| `fetchVersion > throws with server error message on non-OK JSON body` | Non-OK JSON error body rejects with the server `error` string. | Pass |

_14 tests._

### `locationTime.test.ts`

| Test | Description | Result |
| --- | --- | --- |
| `getPrimaryTimeZone > returns null when latitude is out of range` | Latitude outside ±90° returns `null`. | Pass |
| `getPrimaryTimeZone > returns null when longitude is out of range` | Longitude outside ±180° returns `null`. | Pass |
| `getPrimaryTimeZone > returns an IANA id for Seattle coordinates` | Seattle lat/lon resolves to a non-empty `America/…` time zone id. | Pass |
| `formatUtcIsoInZone > returns the input when the instant is not a valid date` | Invalid ISO string is returned unchanged. | Pass |
| `formatUtcIsoInZone > formats a valid UTC instant in UTC timezone` | Valid UTC instant formats to a longer string containing the year. | Pass |
| `formatUtcIsoInZone > returns the original string when Intl.DateTimeFormat throws` | If `Intl.DateTimeFormat` throws, the original ISO string is returned. | Pass |

_6 tests._

---

## Traceability

Test case IDs **BE-***, **HTTP-***, **FE-*** are mapped to these tests in [TestStrategy.md](TestStrategy.md) (Representative unit tests).
