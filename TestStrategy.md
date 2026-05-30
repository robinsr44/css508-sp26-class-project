# Test strategy
This goal of this document is to outline the test strategy for this **moon tracker** project, which includes two main high level components
- frontend (`src/frontend`): **React + TypeScript** Single Page Application (SPA)
- backend (`src/backend/`): **C++** which includes the API `moon-api` and the calculations in `moon_ephemeris.cpp`

# Scope
**Area Under Test**:
- `moon_ephemeris` and any additional parsing helpers
- `moon_api` and available HTTP routes (GET and POST)
- Request and error response validation for the API
- Verify the API-client behavior as well as display components
- **Browser E2E** — **Playwright** + Chromium against **Vite** with live **`moon-api`** (see [E2ETestPlan.md](E2ETestPlan.md))
- Additional smoke tests for proof-of-life and sanity checking (API scripts, Docker, live fixture)


# General Processes
## Methodology
The test strategy will follow a layered testing strategy with the following levels:
1. Unit testing (Base) - check one function/component in isolation (mock dependencies)
2. Integration Testing — Real pieces wired together: check interfaces and how they talk to each other (not the full browser journey; that is E2E).
3. E2E - test the whole app

## Tools
| Area | Typical tools (see [Test levels](#test-levels) for detail) |
|------|------------------------------------------------------------|
| Backend unit | **CMake** + **ctest**; **GoogleTest** or **Catch2** built from the same C++ code as `moon-api`. |
| Frontend unit | **Vitest** (or Jest) with **jsdom** for TS/React tests under `src/frontend`. |
| API / contract | `curl` sends the HTTP requests; `jq` picks fields out of the JSON. Either run those in a shell or wrap them in a small script. Run moon-api locally on a fixed port so tests always hit the same endpoint. |
| E2E (browser) | **Playwright** + **Chromium** (`src/frontend/e2e/`): real clicks against **Vite** while **`moon-api` listens on 8080**. |
| Packaging | **Docker** / **Docker Compose** for production-like smoke (`/api/health`, sample `/api/moon`). |

## Automation Strategies
| Strategy | Description |
|----------|-------------|
| **Local** | Day to day: **CMake** for the backend, **npm** for the frontend. Full Docker builds are optional; see **README**. |
| **CI** | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — lint, Vitest, **ctest**, moon-api smoke, live fixture, Docker. [`.github/workflows/e2e.yml`](.github/workflows/e2e.yml) — Playwright on pull requests. |
| **E2E** | Smoke compute + visibility (**E2E-01**); API error path (**E2E-02**). |
| **Beta (stretch)** | Real people try the app and give feedback on design and usability. |

# Test levels

## Unit tests
### Backend (C++)

**Primary targets**

- **`moon_ephemeris`** — Pure functions with no network or filesystem I/O: Julian/unix conversion, date/time parsing, lunar phase and illumination, moonrise/moonset for a UTC day, `compute_full`, and sun position helpers. This is the main **unit** surface: same inputs should yield the same floating-point outputs within documented tolerances (UI-grade accuracy, not navigation-grade).
- **`moon_api` (automated via `moon_api_tests`)** — The build also runs **in-process HTTP tests** against `register_moon_api_routes`: a `httplib` server on `127.0.0.1` in a background thread while tests issue real `GET`/`POST`/`OPTIONS` requests. These validate status codes, JSON shapes, CORS headers, validation errors (**400**), and GET/POST parity for moon and sun routes. They sit at the boundary between **unit** (no separate deployable process) and **API contract** testing; both backends use **GoogleTest**.

**What to exercise**

- **Deterministic (same inputs -> same outputs)** — Check that [ephemeris](https://en.wikipedia.org/wiki/Ephemeris) answers match expected numbers within a **fixed tolerance** (for example, a small difference allowed for angles or time), so unintended changes are caught in automated tests, not just when clicking through the app.
- **Representative ephemeris cases** — Mid-latitude (i.e. not pole or equator) fixtures (fixed input datasets) with **normal** visibility (moonrise/moonset present); high-latitude or polar cases where **`always_up`** / **`always_down`** apply; edge dates (leap years, month boundaries); default UTC time when omitted (**12:00** per README).
- **Sun position** — When we use `compute_sun_full` for the **same place, date, and time** we used for the moon, the sun result should match that moment. Check sun [azimuth](https://en.wikipedia.org/wiki/Azimuth) (direction along the horizon) and **altitude** (height in the sky): both should be ordinary numbers in believable degree ranges, not invalid values.
- **Parsing and time helpers** — `parse_date`, `parse_time_hh_mm`, and ISO-8601 output: valid inputs accepted, invalid inputs rejected on paths the API relies on.

**Representative unit tests** ([TestPlan.md](TestPlan.md) case IDs → `moon_ephemeris_tests` in [`moon_ephemeris_test.cpp`](src/backend/tests/moon_ephemeris_test.cpp))

| Case ID | GoogleTest name(s) |
|---------|---------------------|
| **BE-01** | `ComputeFull.PhaseNameIsKnown`, `ComputeFull.ConsistentWithComponents`, `MoonTimes.MidLatitudeSummerDay` |
| **BE-02** | `MoonTimes.HighLatitudePolarFlags` |
| **BE-03** | `MoonTimes.LeapDay` |
| **BE-04** | `ParseDate.RejectsInvalid`, `ParseTime.RejectsInvalid` (plus `ParseDate.AcceptsValidAndBoundaries`, `ParseTime.AcceptsValidAndBoundaries` for happy paths) |
| **BE-05** | `SunPosition.RangeDegrees`, `ComputeSunFull.MatchesSunPosition` |

**Representative unit tests** ([TestPlan.md](TestPlan.md) case IDs → `moon_api_tests` in [`moon_api_test.cpp`](src/backend/tests/moon_api_test.cpp))

| Case ID | GoogleTest name(s) |
|---------|---------------------|
| **HTTP-01** | `MoonApiHealth.GetOk` |
| **HTTP-02** | `MoonApiVersion.GetHasServiceAndVersion` |
| **HTTP-03** | `MoonApiGetMoon.Valid200Shape` |
| **HTTP-04** | `MoonApiPostMoon.Valid200Shape`, `MoonApiParity.GetAndPostMoonMatchPhase`, `MoonApiGetMoon.DefaultTimeNoonWhenTimeOmitted` |
| **HTTP-05** | `MoonApiGetSun.Valid200Shape`, `MoonApiPostSun.Valid200Shape`, `MoonApiParity.GetAndPostSunMatchPosition` |
| **HTTP-06** | `MoonApiGetMoon.MissingParams400` |
| **HTTP-07** | `MoonApiGetMoon.LatLonOutOfRange400`, `MoonApiGetMoon.InvalidLatLon400`, `MoonApiPostMoon.LatLonMustBeNumbers400` |
| **HTTP-08** | `MoonApiGetMoon.InvalidDate400`, `MoonApiGetMoon.InvalidTime400`, `MoonApiPostMoon.InvalidJson400`, `MoonApiPostMoon.MissingKeys400`, `MoonApiPostMoon.DateMustBeString400` |
| **HTTP-09** | `MoonApiCors.OptionsMoon`, `MoonApiCors.OptionsSun`, `MoonApiCors.OptionsHealth`, `MoonApiCors.OptionsVersion` |

**Tooling and layout**

- **CMake** enables testing; **`ctest`** runs registered executables (e.g. from the build directory: `ctest` or `ctest -R moon_`).
- **`moon_ephemeris_tests`** — links only the **`moon_ephemeris`** static library (same sources as `moon-api`).
- **`moon_api_tests`** — links **`moon_api`** (and thus **`moon_ephemeris`**) plus **GoogleTest**; exercises the same route registration code the `moon-api` binary uses.


### Frontend (TypeScript)

**Primary targets**

- The browser **does not** run moon or sun math; the C++ API returns finished JSON. So frontend unit tests focus on **everything else**:
    - data requests
    - how the data is shown
    - conversion of API timestamps into local labels.

- **`locationTime.ts`** (and similar) — From **lat/lon**, **`tz-lookup`** finds a time zone name when possible; when it doesn’t, the UI should still behave (fallback). The API returns **UTC** strings; these helpers show **local** times using the browser’s **`Intl`** formatting. Tests: **works**, **fallback**, and **same test input → same text every time** so formatting doesn’t drift quietly.
- **`api.ts`** — Build `/api/moon` and `/api/sun` URLs with the right query parameters, serialize `GET` vs `POST` bodies, and handle **`fetch`** outcomes: HTTP errors, non-JSON bodies, and JSON error objects like `{ "error": "..." }` from the API.
- **Components (optional)** — **App** and form components: validation messages, loading and error UI, and submit behavior using **mocked `fetch`** (or an injected API client) so tests do not call the real network.

**Tooling:** **Vitest** (fits Vite) or **Jest** with **jsdom**; colocate tests with sources or use `src/frontend/src/**/*.test.ts(x)`.

**Representative unit tests** ([TestPlan.md](TestPlan.md) case IDs → Vitest in [`App.test.tsx`](src/frontend/src/App.test.tsx), [`api.test.ts`](src/frontend/src/api.test.ts), [`locationTime.test.ts`](src/frontend/src/locationTime.test.ts))

| Case ID | Test file | Test name(s) |
|---------|-----------|----------------|
| **FE-01** | `App.test.tsx` | `disables Compute and shows hint when latitude, longitude, or date is empty` |
| **FE-02** | `App.test.tsx` | `submits the form and shows moon phase from mocked API responses` |
| **FE-03** | `App.test.tsx`, `api.test.ts` | `shows API error message when moon request fails` · `fetchMoon > throws with server error message on non-OK JSON body` · `fetchMoon > throws on non-JSON error body` · `fetchMoon > throws on 200 with unexpected shape` · `fetchMoon > throws helpful message on network failure` |
| **FE-04** | `App.test.tsx`, `locationTime.test.ts` | `submits the form…` (expects local instant label) · `getPrimaryTimeZone` / `formatUtcIsoInZone` tests |
| **FE-05** | `App.test.tsx` | `shows UTC-only copy when no timezone is found for coordinates` |
| **FE-06** | `App.test.tsx` | `Copy URL updates feedback after moon URL copy` |
| **FE-07** | `App.visibility.test.tsx` | Normal visibility (rise/set, hours, UTC line); `always_up` / `always_down` copy |
| **FE-08** | `App.resilience.test.tsx` | Moon or sun failure → alert; no partial results |
| **FE-09** | `App.display.test.tsx` | Local + UTC instants on moon/visibility/sun; raw JSON toggle |
| **FE-10** | `App.formUx.test.tsx` | Invalid coordinates; loading state; failed re-submit clears results |
| **FE-11** | — | *Deferred* (no location search UI) |
| **FE-12** | — | *Deferred* (no geolocation UI) |

## Integration tests

Integration tests check **multiple layers at once**—more than a single function in isolation, but involves a subset of the system as compared to **E2E**.

- **HTTP API / contract** — Check GET and POST responses for an actual server that is running
- **Frontend + API (optional)** — Optional: **Vite** plus a running **`moon-api`** so the browser uses real **`/api`** traffic (not mocks). Use when you still need to prove the proxy and paths work end-to-end.
- **Packaging / deploy smoke** — Tests that the docker container is building correctly and contains the requisite components
- **Live API fixture** — [`scripts/ci/live-moon-fixture.sh`](scripts/ci/live-moon-fixture.sh) (**INT-03**) on the Seattle E2E query
- **Extended smoke** — [`scripts/ci/moon-api-smoke.sh`](scripts/ci/moon-api-smoke.sh) (**INT-04**): sun GET, POST routes, default UTC noon
- **Manual lunar cycle** — [docs/ManualTesting.md](docs/ManualTesting.md) (**MANUAL-01**)

## End-to-end (browser)

E2E complements **Vitest** (mocked `fetch`) with **real Chromium**, **live `/api`** through the Vite proxy, and a **`global-setup`** health gate. See [E2ETestPlan.md](E2ETestPlan.md).

| Case | Spec |
|------|------|
| **E2E-01** | [`e2e/smoke.spec.ts`](src/frontend/e2e/smoke.spec.ts) — compute + visibility + sun labels |
| **E2E-02** | [`e2e/errors.spec.ts`](src/frontend/e2e/errors.spec.ts) — stubbed moon **400** |
| **E2E-03** | [`e2e/accessibility.spec.ts`](src/frontend/e2e/accessibility.spec.ts) — axe + keyboard submit |
| **E2E-04** | [`scripts/ci/docker-e2e.sh`](scripts/ci/docker-e2e.sh) — Playwright via Docker Compose |

# Metrics

Numbers we can watch for this project once we baseline a machine or deploy somewhere we can measure (set targets when you have real data).

| Metric | Description |
|--------|-------------|
| **API response time** | How long a typical **`/api/moon`** or **`/api/sun`** call takes from request to full JSON on a quiet machine (same host or LAN). |
| **Service startup** | How long from starting **`moon-api`** (or **`docker compose up`**) until **`/api/health`** answers OK. |
| **Frontend bundle weight** | Size of the **production** JS/CSS the browser downloads after **`npm run build`** (larger usually means slower first load). |
| **Time to interactive UI** | Time from page load until moon tracker UI is ready to accept input (cold load, no cache). |
| **End-to-end compute delay** | How long after the user runs **Compute** until moon and sun results appear on screen (network and UI included). |
| **Uptime and downtime** | Share of time the app answers **`/api/health`** (and the main page, if checked) successfully from the outside, versus time it fails or times out—often from a hosting dashboard or a simple scheduled **ping** once the service is on the public internet. |
| **Visitors** | How many people open the site in a day or week (counts of visits or unique browsers), from **web analytics** (for example a small script on the page) or **server access logs** if we control the web server. |
