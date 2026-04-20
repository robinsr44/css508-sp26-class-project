# Project selection

## Chosen project - Moon Tracker

The project is a simple Moon Tracker project. I have a personal interest in the cosmos and it feels timely given the Artemis II launch to the moon. The goal of this project is create a project with an interactive frontend (webpage), a backend (call to server), and the ability to run in CI. Additionally, the project can be used for learning about software testing and using AI tools as an "AI-native" workflow.

It is a simple project that features the following components:
- An interactive web page frontend
- Interaction with a RESTful API

This makes a great project from a testing standpoint because:
- The responses are deterministic, given the same system inputs, you will receive the same output response
- The system is stateless, meaning that each request is handled using only what is in the request (not dependent on a previous or future state)

The project can be split into natural test layers:
- Unit Tests: for logic in isolation, frontend helpers, API client
- API / Contract Tests: requests, status codes, error bodies
- Integration Tests: between the frontend and backend (could also include docker)
- E2E Testing: for the entire usage process

### Implemented automated tests (current repo)

The following are **in place** (GoogleTest for C++, Vitest for TypeScript):

| Layer | Location |
|--------|----------|
| **Ephemeris** | [`src/backend/tests/moon_ephemeris_test.cpp`](src/backend/tests/moon_ephemeris_test.cpp) — Julian/unix round-trips, `parse_date` / `parse_time_hh_mm`, `iso8601_utc_from_jd`, `compute_illumination`, `moon_position`, `moon_times_for_utc_day`, `compute_full`, `sun_position` / `compute_sun_full` |
| **HTTP API** | [`src/backend/tests/moon_api_test.cpp`](src/backend/tests/moon_api_test.cpp) — In-process [`httplib::Server`](https://github.com/yhirose/cpp-httplib) with [`register_moon_api_routes`](src/backend/src/moon_api.h); covers health, version, CORS `OPTIONS` (including `/api/health` and `/api/version`), `GET`/`POST` `/api/moon` and `/api/sun`, validation and error bodies, `POST` `date` must be a JSON string, mid-latitude visibility (`hours_above_horizon` when rise+set), polar visibility shape, GET↔POST phase parity |
| **Frontend** | [`src/frontend/src/api.test.ts`](src/frontend/src/api.test.ts), [`locationTime.test.ts`](src/frontend/src/locationTime.test.ts), [`App.test.tsx`](src/frontend/src/App.test.tsx) — mocked `fetch`, timezone helpers, `App` smoke + **Compute** with mocked moon/sun responses |

**Backend layout:** HTTP routes and JSON for moon/sun live in [`moon_api.cpp`](src/backend/src/moon_api.cpp) / [`moon_api.h`](src/backend/src/moon_api.h). [`main.cpp`](src/backend/src/main.cpp) only parses the listen port, constructs the server, and calls `register_moon_api_routes`.

**Docker:** The [Dockerfile](Dockerfile) defines **`test-backend`** (runs `ctest` for ephemeris + API tests) and **`test-frontend`** (runs `npm test`). Compose services under profile **`test`** are documented in [README.md](README.md) (*Unit tests in Docker*) and [docker-compose.yml](docker-compose.yml).

**Run locally:** `ctest` from the CMake build directory; `npm test` in [`src/frontend`](src/frontend). See [README.md](README.md) for backend CMake and frontend scripts.

## AI Generated Tests

### Unit Tests

Below is a **text catalog** of unit-test *ideas* that align with the MVP: React/TypeScript client ([`src/frontend/src/`](src/frontend/src/)), C++ ephemeris ([`src/backend/src/moon_ephemeris.cpp`](src/backend/src/moon_ephemeris.cpp)), and HTTP/JSON wiring ([`src/backend/src/moon_api.cpp`](src/backend/src/moon_api.cpp)). *Narrow UI layout in [`App.tsx`](src/frontend/src/App.tsx) is partly covered by [`App.test.tsx`](src/frontend/src/App.test.tsx); richer layout/E2E remains optional.*

---

#### Frontend — [`locationTime.ts`](src/frontend/src/locationTime.ts)

**`getPrimaryTimeZone(lat, lon)`**

- Returns a non-empty IANA string for a known point (e.g. Seattle: ~47.6062, -122.3321 → `America/Los_Angeles`).
- Returns `null` when latitude is outside **[-90, 90]**.
- Returns `null` when longitude is outside **[-180, 180]**.
- Returns `null` if `tz-lookup` throws (defensive; may be simulated with an invalid coordinate if the library ever throws).

**`formatUtcIsoInZone(isoUtc, timeZone)`**

- Parses a valid UTC ISO string (e.g. `2026-04-05T12:00:00Z`) and returns a formatted string that is non-empty and different from raw UTC when using a fixed locale and a valid zone (e.g. `America/Los_Angeles`).
- For an **unparseable** `isoUtc`, returns the input string unchanged.
- For **`Intl` failure** (e.g. simulated constructor throw), returns the original `isoUtc` (fallback path). Implemented tests use a mocked `Intl.DateTimeFormat` to cover this branch reliably.

---

#### Frontend — [`api.ts`](src/frontend/src/api.ts) (`fetchMoon`)

Use a **global `fetch` mock** (Vitest). `parseMoonJson` is private; behavior is covered by successful `fetchMoon` paths in [`api.test.ts`](src/frontend/src/api.test.ts), including `always_up` visibility and `fetchVersion` error paths.

**Network / transport**

- When `fetch` rejects with `TypeError` and message `Failed to fetch`, throws an error whose message mentions starting the backend on port **8080** and the **`/api` proxy** (user-facing copy).
- Same for messages containing `NetworkError` or `Load failed` (browser variants).
- When `fetch` rejects with another `TypeError` message, rethrows the original error.

**HTTP error responses (`!res.ok`)**

- **400** with JSON body `{"error":"lat and lon must be numbers"}` → thrown `Error` message equals that `error` string.
- **502** (or any status) with **non-JSON** body (e.g. HTML) → thrown message includes status and a **truncated** body snippet (first ~120 chars), not a JSON parse exception.

**HTTP 200**

- Valid JSON with `instant_utc` string and `phase` object → resolves to `MoonApiResponse` (spot-check nested fields if needed).
- Body is **invalid JSON** → throws mentioning **JSON** and **moon-api / port 8080**.
- JSON parses but **missing** `instant_utc` or **invalid** `phase` → throws **Unexpected API response shape**.

**Query string**

- `URLSearchParams` includes `lat`, `lon`, `date`, `time` matching the input arguments (encoding preserved for typical values).

---

#### Backend C++ — [`moon_ephemeris`](src/backend/src/moon_ephemeris.cpp) / [`moon_ephemeris.h`](src/backend/src/moon_ephemeris.h)

**`parse_date(ymd, y, m, d)`**

- Accepts `2026-04-05` and sets `y=2026`, `m=4`, `d=5`; returns `true`.
- Rejects malformed strings (`2026/04/05`, `2026-4`, empty); returns `false`.
- Rejects year outside **1900–2100**; rejects month outside **1–12**; rejects day outside **1–31** (per current validation).

**`parse_time_hh_mm(hm, hh, mm)`**

- Accepts `12:00`, `00:00`, `23:59`; returns `true` and correct `hh`/`mm`.
- Rejects empty string; rejects `24:00`, `12:60`, `12`; rejects non-matching formats.

**`julian_date_from_unix_seconds` / `unix_seconds_from_julian_date`**

- Round-trip within tolerance: `unix → jd → unix` for a known epoch (e.g. Unix `0` or a fixed test timestamp).

**`compute_illumination(jd)`**

- For a fixed `jd`, `fraction` is in **[0, 1]**; `phase` is in **[0, 1)** or normalized; `sun_moon_earth_deg` is finite (smoke + range).

**`moon_times_for_utc_day` / `compute_full`**

- **Mid-latitude** location and date: returns `normal` times or rise/set `optional`s consistent with `always_up`/`always_down` flags (not both).
- **Polar / edge** case: may return `always_up` or `always_down` (golden or property: flags mutually exclusive with having both rise and set when implementation guarantees it).

**`iso8601_utc_from_jd`**

- Output matches `YYYY-MM-DDTHH:MM:SSZ` pattern; for a known `jd`, compare to precomputed string (golden file).

**`compute_full`**

- Deterministic: same inputs → same `phase_name`, `illumination`, and time flags (floating-point tolerance for doubles).
- `phase_name` is one of the eight strings defined by the phase bucketing logic (New, Waxing Crescent, …).

---

#### Backend — JSON builder behavior (via `compute_full` + [`build_json`](src/backend/src/moon_api.cpp) or HTTP tests)

`build_json` / `build_sun_json` live in [`moon_api.cpp`](src/backend/src/moon_api.cpp). **Shape and visibility branches** (`normal` vs `always_up` / `always_down`, `hours_above_horizon`) are covered by [`moon_api_test.cpp`](src/backend/tests/moon_api_test.cpp) against the live handler chain, not by isolating `build_json` alone.

- `instant_utc` equals `YYYY-MM-DDTHH:MM:00Z` for the request’s UTC date/time.
- `location.latitude` / `location.longitude` echo the request.
- `illumination.percent` equals `fraction * 100` within epsilon.
- `visibility.state` is `always_up` | `always_down` | `normal`; for `normal` with both rise and set JD, `hours_above_horizon` is non-negative hours.

---

#### Explicitly *not* only unit tests (other layers)

- **Full HTTP surface** (all routes, CORS): now also covered by **C++ `moon_api` tests** above; additional **curl/integration** or **Docker** checks remain useful for nginx and deployed URLs.
- **React `App`**: a **component** test submits **Compute** with mocked `fetch` ([`App.test.tsx`](src/frontend/src/App.test.tsx)); fuller flows remain **E2E** (Playwright/Cypress) or manual.

---

*This catalog is descriptive; implementing it may require exporting small pure functions (e.g. `parseMoonJson`) or sharing test utilities for `fetch` mocks.*

### Integration Tests

**Integration tests** here mean **multiple real components** wired together (HTTP server + ephemeris + JSON, proxy + backend, or containerized stack), without driving a full browser user flow (that is **E2E**). They use **real network I/O** to the running service(s), not mocked `fetch`.

---

#### Preconditions (fixtures)

- **`moon-api` binary** listening on a known port (e.g. **8080**), started by test harness or CI job before the suite.
- Optional: **Vite dev server** on **5173** with [`vite.config.ts`](src/frontend/vite.config.ts) proxy to 8080.
- Optional: **Docker Compose** (or built image) with **nginx** + **moon-api** per [`docker-compose.yml`](docker-compose.yml) and [`docker/nginx.conf`](docker/nginx.conf).

---

#### HTTP API against live `moon-api` (direct to backend)

Use `curl`, REST Client, or test code (`fetch`, `httplib` client, etc.) against `http://127.0.0.1:8080`.

**`GET /api/health`**

- Returns **200**, `Content-Type` includes `application/json`, body parses to `{ "status": "ok" }` (or equivalent documented shape).

**`GET /api/moon` — success path**

- Valid query: `lat`, `lon`, `date` (and optional `time`) → **200**, JSON parses, top-level keys include `instant_utc`, `location`, `phase`, `illumination`, `visibility`.
- Same request twice → **identical** JSON body (determinism check for MVP).
- Omit `time` → defaults to **12:00 UTC** instant in `instant_utc` for that date (per server logic).

**`GET /api/moon` — validation errors (400)**

- Missing `lat`, `lon`, or `date` → **400**, JSON `{ "error": "..." }` mentioning required params (matches [`moon_api.cpp`](src/backend/src/moon_api.cpp) messages).
- Non-numeric `lat`/`lon` → **400**, `lat and lon must be numbers`.
- Bad `date` format → **400**, `date must be YYYY-MM-DD`.
- Bad `time` format → **400**, `time must be HH:MM in UTC`.
- `lat`/`lon` out of range → **400**, lat/lon bounds error.

**`POST /api/moon`**

- Valid JSON body with `lat`, `lon`, `date`, optional `time` → same **semantic result** as equivalent GET (spot-check one shared case).
- Invalid JSON → **400** with `invalid JSON` (or documented error).
- Missing required fields → **400** with documented `error` string.
- **`date` not a JSON string** (e.g. numeric) → **400** with a clear `error` (see `parse_post_moon_sun_body` in [`moon_api.cpp`](src/backend/src/moon_api.cpp)).

**CORS (optional but valuable for integration)**

- `OPTIONS /api/moon`, `/api/sun`, `/api/health`, `/api/version` → **204** with `Access-Control-Allow-Origin` and related headers (see `set_cors` in [`moon_api.cpp`](src/backend/src/moon_api.cpp)); **`moon_api` unit tests** already assert several of these.

---

#### Proxy integration: **Vite** → **`moon-api`**

Assumes dev server and API are both up.

- `GET http://127.0.0.1:5173/api/moon?...` (through proxy) returns **same status and body** as `GET http://127.0.0.1:8080/api/moon?...` for the same query string (proves [`server.proxy`](src/frontend/vite.config.ts) path).
- Failure case: API stopped → request via **5173** returns **502/connection error** from proxy (document expected behavior for your Vite version); assert the UI or client can surface an error if this is tested with `fetchMoon`.

---

#### Frontend client + live API (`fetchMoon` integration)

- With **`moon-api` running**, call **`fetchMoon`** from Node or browser test with **base URL** or **relative `/api`** in an environment where `/api` resolves to the real backend (e.g. Vitest `test` environment with proxy, or `page.request` in Playwright against dev URL).
- Successful call returns an object that satisfies **`MoonApiResponse`** (shape check).
- Intentionally wrong params → thrown `Error` message matches API `error` field (end-to-end error propagation).

---

#### Docker / nginx integration

- **Unit tests in Docker:** build targets `test-backend` / `test-frontend` (Compose profile `test`) per [README.md](README.md); does not replace browser or nginx integration.
- Build and run stack (e.g. `docker compose up --build`).
- `GET http://localhost` (or mapped port) serves the **built frontend** (`index.html`).
- `GET http://localhost/api/moon?...` (same host) is **proxied** to `moon-api` → **200** and valid JSON (proves [`nginx.conf`](docker/nginx.conf) `location /api/`).
- `GET /api/health` through nginx → **200** and healthy JSON.

---

#### What integration tests usually *omit* (covered elsewhere)

- **tz-lookup / Intl** local-time formatting: already covered in **unit** tests; integration can assert only that the **API** payload is unchanged over the wire.
- **Full click “Compute” workflow**: **E2E** (browser automation), not integration, unless you define “integration” broadly.

---

*Implement with a test runner that can start/stop the binary (fixture), or with CI services that run `moon-api` in the background before `curl`/HTTP assertions.*

### End-to-End Testing

**End-to-end (E2E) tests** exercise the **real browser**: load the SPA, interact with the DOM, and assert visible outcomes. They require **moon-api** (and optionally **Vite** or **Docker/nginx**) running—same stack a developer would use locally. Typical tools: **Playwright**, **Cypress**, or **Selenium**.

E2E is best for **user-visible behavior** and **cross-layer wiring** (UI → HTTP → UI). It is a poor place to assert **astronomy correctness** or **every API error string**; keep those in **unit** and **integration** tests so E2E stays stable and fast.

---

#### Tooling (typical choices)

- **Playwright**: strong CI story, trace viewer, multi-browser projects, `page.request` for API checks without the UI, auto-waiting locators.
- **Cypress**: strong local DX; often one browser per run unless using cross-browser add-ons.
- **Selenium**: widely used; heavier setup.

Regardless of tool, configure a **single base URL** (e.g. `PLAYWRIGHT_BASE_URL`, Cypress `baseUrl`) so the same tests run against **Vite**, **Docker**, or a **preview** URL without code changes.

---

#### Preconditions (fixtures)

- **Dev-style E2E**: Start **`moon-api`** on **8080**, then **`npm run dev`** in [`src/frontend`](src/frontend) (Vite proxies [`/api`](src/frontend/vite.config.ts) to the API). Base URL: `http://127.0.0.1:5173` (or the port Vite prints).
- **Production-style E2E**: Run **`docker compose up --build`** and point tests at the mapped **HTTP** port (nginx serves UI + proxies `/api`).
- **CI**: Automate startup—e.g. Playwright **`webServer`** (start Vite + `moon-api` via a script), or a shell script that waits for **`GET /api/health`** before tests. Use **`strictPort: true`** in Vite (or a fixed port) so the base URL does not drift when 5173 is busy.
- **Order**: Start **API** → **frontend** → **tests**; tear down in reverse.

---

#### Waiting, flakiness, and assertions

- Prefer **locator auto-wait** over fixed sleeps.
- After **Compute**, wait for a **stable success signal**: e.g. `getByRole('heading', { name: 'Phase' })` inside `.result-grid`, not bare **`networkidle`** (SPAs often keep connections open).
- **“Computing…”** is **optional** to assert—on fast CI the loading state may never be visible; if you assert it, use a short window or run that check only in serial mode.
- Use **soft assertions** only for nice-to-haves; **hard assert** on core outcomes (results visible, no unexpected **console** errors if you enable that guard).

---

#### Smoke / happy path — [`App.tsx`](src/frontend/src/App.tsx)

- Navigate → **`h1`** or document title matches **Moon tracker** (see [`index.html`](src/frontend/index.html)).
- **Form controls** exist with labels: `#lat`, `#lon`, `#date`, `#time` ([`App.tsx`](src/frontend/src/App.tsx)).
- Fill **latitude**, **longitude**, **date**, **UTC time**; click **Compute** (button enabled when `canSubmit` is true).
- **Date**: `input[type=date]` varies by browser and locale—use the runner’s documented fill API (e.g. `fill('2026-04-05')`). If flaky, fix **locale/timezone** in CI or add a single **`data-testid`** on the date input.
- **Time**: some browsers emit `HH:MM` vs `HH:MM:SS`; the backend parses `HH:MM` ([`moon_ephemeris.cpp`](src/backend/src/moon_ephemeris.cpp)). Ensure fills match what [`api.ts`](src/frontend/src/api.ts) sends in `time=`.
- After success: **`.result-grid`** (or second **`.card`**) shows headings **Phase**, **Illumination**, **Visibility**.
- **Phase**: non-empty phase name + visible numbers (presence over exact values).
- **Illumination**: percent visible; at least one **instant** line (local and/or UTC) depending on `tz-lookup`.
- **Visibility**: assert **one** realistic branch—**normal**, **always_up**, or **always_down**—using **fixed** lat/lon/date from prior experiments, or treat **one** branch as sufficient for smoke.

---

#### Determinism (lightweight E2E)

- Same inputs twice in one session → **phase name** (and stable numbers) match. Avoid comparing **full** localized strings if **Intl** differs across CI workers; prefer phase name + illumination percent.

---

#### Client-side validation (no server round-trip)

- Non-numeric **lat** or **lon** (e.g. `abc`) → submit → **`[role="alert"]`** shows an error; match a **substring** (e.g. “valid numbers”) so exact copy edits do not break the test.
- **Empty fields**: To force **`canSubmit` false**, clear **lat**, **lon**, or **date**. Browsers may resist an empty **date**—use runner APIs or accept “manual / skipped” if impractical; when disabled, assert the hint **Fill in latitude, longitude, and date** appears.

---

#### API unavailable / error surfacing

- **Frontend up**, **`moon-api` down** → **Compute** → **`[role="alert"]`** includes keywords such as **cannot reach**, **8080**, or **proxy** (from [`api.ts`](src/frontend/src/api.ts)), not necessarily the full paragraph.
- **Route mock** (Playwright `page.route`, Cypress `intercept`): return **400** + `{ "error": "..." }` and assert that text (or substring) appears—verifies **UI ↔ error message** without stopping the API.

---

#### Keyboard and focus (optional)

- **Tab** through fields; submit with **Enter** on the focused **Compute** button (or native form submit)—catches click-only handlers.

---

#### Accessibility (recommended)

- Unique **`h1`**; **`label[for=…]`** tied to inputs; errors in **`[role="alert"]`**.
- Optional: **axe-core** (or built-in a11y scan) on default and error states.

---

#### Diagnostics and CI artifacts

- **Screenshot / video / trace** on failure (Playwright trace is especially useful).
- Optional: **HAR** or failed **network** log for `/api/moon`.
- **Parallel runs**: isolate **ports** per worker or run E2E **serially** if all tests share one global `moon-api`.

---

#### Docker / deployed URL E2E

- Hit **`http://localhost:<mapped-port>`** (no Vite); repeat smoke and errors if you can control API availability; otherwise rely on **mocks** for failure paths.

---

#### UX and non-functional (optional)

- **Response time**: soft budget from click to **Phase** visible (tune generously for CI hardware).
- **Visual regression** (screenshot baselines): optional; watch font/OS drift.
- Align with your critique section: **UX metrics** belong here as **light** checks, not as replacements for **unit** math tests.

---

#### What E2E usually does *not* replace

- **Precise ephemeris** vs almanacs → **unit** goldens.
- **Every HTTP 400** → **integration** API tests; E2E samples **one** server-driven error if the UI shows it.
- **Domain logic** that you find yourself re-encoding in E2E → move **down** the pyramid.

---

#### Selectors and file layout

- Prefer **roles** and **visible text**; add **`data-testid`** only when unstable (date input) or **ARIA** is missing.
- Example split: **`e2e/smoke.spec`** (happy path), **`e2e/validation.spec`** (bad numbers), **`e2e/errors.spec`** (down API or mocked 400), **`e2e/a11y.spec`** (optional).


## Critique of AI Selected Tests
The AI did a thorough job of creating test cases at a depth that I would not have been able to create at this speed a limited understanding of all of the components. There are a few things that I would like to make sure are met, that the tests are catching failures at the correct level of testing. What I mean is that we should not be catching logic level failures during E2E testing.

At the unit test level, I would include the tests described by the AI, but I would also ensure that I am testing a robust set of inputs. I'd ensure that I cover edge cases as well as nominal operating values. An edge case example would be like, inputting the local time of 2:30am on spring daylight savings. It could also be looking at an edge for when the the phases of the moon change.

At the E2E level, I'd also check that the overall behavior of the user experience capture, so creating metrics for user experience, which could include response time, color rendering, layout coherance, and usability. These are all on top of the functionality that the E2E testing described by the AI also includes.