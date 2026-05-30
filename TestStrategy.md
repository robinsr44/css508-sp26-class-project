# Test strategy
The goal of this document is to outline the test strategy for this **moon tracker** project, which includes two main high level components
- frontend (`src/frontend`): **React + TypeScript** Single Page Application (SPA)
- backend (`src/backend/`): **C++** which includes the API `moon-api` and the calculations in `moon_ephemeris.cpp`

# Scope
**Area Under Test**:
- `moon_ephemeris` and any additional parsing helpers
- `moon_api` and available HTTP routes (GET and POST)
- Request and error response validation for the API
- Verify the API-client behavior as well as display components
- **Browser E2E** — **Playwright** + Chromium against **Vite** with a live **`moon-api`** (health gate + smoke, stubbed geocoder, accessibility scan); see [E2ETestPlan.md](E2ETestPlan.md)
- Additional smoke tests for proof-of-life and sanity checking (API scripts, Docker)


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
| E2E (browser) | **Playwright** + **Chromium** (`src/frontend/e2e/`): real clicks and assertions against **Vite** while **`moon-api` listens on 8080** (same `/api` proxy as local dev). Optional **Docker Compose** base URL via env vars (see [E2ETestPlan.md](E2ETestPlan.md)). **axe** via **`@axe-core/playwright`** (`color-contrast` disabled for dark-theme demos). |
| Packaging | **Docker** / **Docker Compose** for production-like smoke (`/api/health`, sample `/api/moon`). |

## Automation Strategies
| Strategy | Description |
|----------|-------------|
| **Local** | Day to day: **CMake** for the backend, **npm** for the frontend. Full Docker builds are optional; see **README**. |
| **CI** | **GitHub Actions**: [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — frontend **Vitest**/lint, backend **cmake**/**ctest** + moon-api TCP smoke, Docker compose smoke. [`.github/workflows/e2e.yml`](.github/workflows/e2e.yml) — build **`moon-api`**, **Playwright** **`npm run test:e2e`** on pull requests. |
| **E2E** | Automated full-stack browser checks (live **`/api/moon`** & **`/api/sun`** through the dev proxy, illum time-toggle UI, stubbed **Nominatim** route, post-compute **axe** scan). Mapped to **E2E-01**–**E2E-03** in [TestPlan.md](TestPlan.md). |
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
| **HTTP-04** | `MoonApiPostMoon.Valid200Shape`, `MoonApiParity.GetAndPostMoonMatchPhase` |
| **HTTP-05** | `MoonApiGetSun.Valid200Shape`, `MoonApiPostSun.Valid200Shape` |
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

**Representative unit tests** ([TestPlan.md](TestPlan.md) case IDs → Vitest in [`App.test.tsx`](src/frontend/src/App.test.tsx), [`App.visibility.test.tsx`](src/frontend/src/App.visibility.test.tsx), [`MoonPhase.test.tsx`](src/frontend/src/MoonPhase.test.tsx), [`phaseDisplayName.test.ts`](src/frontend/src/phaseDisplayName.test.ts), [`visibilityText.test.ts`](src/frontend/src/visibilityText.test.ts), [`test/ephemerisMirror.test.ts`](src/frontend/src/test/ephemerisMirror.test.ts), [`api.test.ts`](src/frontend/src/api.test.ts), [`locationTime.test.ts`](src/frontend/src/locationTime.test.ts))

| Case ID | Test file | Test name(s) |
|---------|-----------|----------------|
| **FE-01** | `App.test.tsx` | `disables Compute and shows hint when latitude, longitude, or date is empty` |
| **FE-02** | `App.test.tsx` | `submits the form and shows moon phase from mocked API responses` |
| **FE-03** | `App.test.tsx`, `api.test.ts` | `shows API error message when moon request fails` · `fetchMoon > throws with server error message on non-OK JSON body` · `fetchMoon > throws on non-JSON error body` · `fetchMoon > throws on 200 with unexpected shape` · `fetchMoon > throws helpful message on network failure` |
| **FE-04** | `App.test.tsx`, `locationTime.test.ts` | `submits the form…` (expects local instant label) · `getPrimaryTimeZone` / `formatUtcIsoInZone` tests |
| **FE-05** | `App.test.tsx` | `shows UTC-only copy when no timezone is found for coordinates` |
| **FE-06** | *(deferred)* | Copy URL / curl helpers described in Design are **not** in current `App.tsx`; covered manually or in a future feature PR. |

## Integration tests

Integration tests check **multiple layers at once**—more than a single function in isolation, but short of a **full browser user journey** (that is **E2E**, below).

- **HTTP API / contract** — Check GET and POST responses for an actual server that is running (including **`moon_api`** + **`ctest`**, black-box scripts against **`moon-api`** on a fixed port, and Docker smoke **`/api`** checks).
- **Packaging / deploy smoke** — Tests that the docker container is building correctly and contains the requisite components.

Driving **Chromium** through the SPA while **`moon-api`** and **Vite** run together is **end-to-end** automation (**Playwright**), not integration.

## End-to-end (browser)

E2E complements **Vitest** (fast, deterministic mocks) by exercising **real Chromium**, **real HTTP** to **`moon-api`**, and **`global-setup`** health checks before specs run.

| Topic | Approach |
|-------|----------|
| **Stack** | **`moon-api` on 8080**; Playwright starts **Vite** (embedded webServer) so **`/api`** is proxied like developer workflow. |
| **Specs** | [`smoke.spec.ts`](src/frontend/e2e/smoke.spec.ts), [`failure.spec.ts`](src/frontend/e2e/failure.spec.ts), [`location-search-failure.spec.ts`](src/frontend/e2e/location-search-failure.spec.ts), [`keyboard.spec.ts`](src/frontend/e2e/keyboard.spec.ts), [`accessibility.spec.ts`](src/frontend/e2e/accessibility.spec.ts) (axe; **color-contrast** off). **Docker:** [`docker-playwright.sh`](scripts/ci/docker-playwright.sh) in CI **container** job. |
| **CI** | Workflow **[`e2e.yml`](.github/workflows/e2e.yml)** on **`pull_request`** (opened, synchronize, reopened). |
| **Detail / commands** | [E2ETestPlan.md](E2ETestPlan.md) |

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
