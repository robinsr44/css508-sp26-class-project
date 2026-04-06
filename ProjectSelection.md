# Project selection

## Chosen project - Moon Tracker

The project is a simple Moon Tracker project. I have a personal interest in the cosmos and it feels timely given the Artemis II launch to the moon. The goal of this project is create a project with an interactive frontend (webpage), a backend (call to server), and the ability to run in CI. Additionally, the prject can be used as for learning for about software testing and using AI tools as an "AI-native".

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

## AI Generated Tests

### Unit Tests

Below is a **text catalog** of unit tests that match the current MVP: React/TypeScript client ([`src/frontend/src/`](src/frontend/src/)), C++ ephemeris ([`src/backend/src/moon_ephemeris.cpp`](src/backend/src/moon_ephemeris.cpp)), and HTTP wiring ([`src/backend/src/main.cpp`](src/backend/src/main.cpp)). *Pure UI layout in [`App.tsx`](src/frontend/src/App.tsx) is usually covered by component or E2E tests; only logic-level cases are listed here.*

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
- For an **invalid** `timeZone` (if `Intl` throws `RangeError`), returns the original `isoUtc` (fallback path).

---

#### Frontend — [`api.ts`](src/frontend/src/api.ts) (`fetchMoon`)

Use a **global `fetch` mock** (Vitest/Jest). `parseMoonJson` is private; behavior is covered by successful `fetchMoon` paths or by exporting `parseMoonJson` only under test.

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

#### Backend — JSON builder behavior (via `compute_full` + [`build_json`](src/backend/src/main.cpp) or golden HTTP tests)

If `build_json` stays in `main.cpp`, these are often **integration** tests; they can still be listed as **target behavior** for unit-level extraction later.

- `instant_utc` equals `YYYY-MM-DDTHH:MM:00Z` for the request’s UTC date/time.
- `location.latitude` / `location.longitude` echo the request.
- `illumination.percent` equals `fraction * 100` within epsilon.
- `visibility.state` is `always_up` | `always_down` | `normal`; for `normal` with both rise and set JD, `hours_above_horizon` is non-negative hours.

---

#### Explicitly *not* unit tests (other layers)

- **Full HTTP server** (httplib routes, CORS): prefer **API/integration** tests hitting `GET /api/moon` and `/api/health`.
- **React `App`**: prefer **component** tests (Testing Library) or **E2E** for “Compute” flow; optional: extract validation helpers from `onSubmit` and unit-test those.

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

- Missing `lat`, `lon`, or `date` → **400**, JSON `{ "error": "..." }` mentioning required params (matches [`main.cpp`](src/backend/src/main.cpp) message).
- Non-numeric `lat`/`lon` → **400**, `lat and lon must be numbers`.
- Bad `date` format → **400**, `date must be YYYY-MM-DD`.
- Bad `time` format → **400**, `time must be HH:MM in UTC`.
- `lat`/`lon` out of range → **400**, lat/lon bounds error.

**`POST /api/moon`**

- Valid JSON body with `lat`, `lon`, `date`, optional `time` → same **semantic result** as equivalent GET (spot-check one shared case).
- Invalid JSON → **400** with `invalid JSON` (or documented error).
- Missing required fields → **400** with documented `error` string.

**CORS (optional but valuable for integration)**

- `OPTIONS /api/moon` → **204** (or documented status) with `Access-Control-Allow-Origin` and related headers present (see [`main.cpp`](src/backend/src/main.cpp) `set_cors`).

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

---

#### Preconditions (fixtures)

- **Dev-style E2E**: Start **`moon-api`** on **8080**, then **`npm run dev`** in [`src/frontend`](src/frontend) (Vite proxies [`/api`](src/frontend/vite.config.ts) to the API). Base URL: `http://127.0.0.1:5173` (or the port Vite prints).
- **Production-style E2E**: Run **`docker compose up --build`** and point tests at the mapped **HTTP** port (nginx serves UI + proxies `/api`).
- Tests should **wait** for network idle or for result selectors after click (avoid flaky timing).

---

#### Smoke / happy path — [`App.tsx`](src/frontend/src/App.tsx)

- Navigate to the app → page title or **`h1`** contains **Moon tracker** (or matches [`index.html`](src/frontend/index.html) `<title>`).
- **Form controls** are present and labeled: `#lat`, `#lon`, `#date`, `#time` (see `htmlFor` / `id` in [`App.tsx`](src/frontend/src/App.tsx)).
- Set **latitude**, **longitude**, **date** (use `input[type=date]` fill pattern for the runner), and **UTC time**; click **Compute** (submit button not disabled when fields are filled).
- While the request is in flight (optional strict assertion): button text is **Computing…** or button is disabled.
- After success: a **results** area appears (e.g. `.result-grid` or second `.card`) with headings **Phase**, **Illumination**, **Visibility**.
- **Phase** section shows a **phase name** string (non-empty) and numeric-looking lines (cycle fraction, angle).
- **Illumination** shows a **percent** and either **Instant (local)** / **Instant (UTC)** or UTC-only line depending on timezone resolution.
- **Visibility** shows state-appropriate content: **normal** (moonrise/moonset lines or muted UTC lines), **always_up**, or **always_down** text for polar cases (use a coordinate/date known to trigger each branch, or accept one branch as smoke-only).

---

#### Determinism (lightweight E2E)

- Submit the **same** lat, lon, date, time twice in one session → **Phase** name (and key numbers if stable in CI) **match** between runs (same browser, same backend build).

---

#### Client-side validation (no server round-trip)

- Clear **latitude** or **longitude** to non-numeric text (e.g. `abc`) → submit → **`role="alert"`** (or `.error`) shows **Latitude and longitude must be valid numbers.** (or equivalent).
- Leave required fields empty so **Compute** is **disabled** → assert **Fill in latitude, longitude, and date to compute.** is visible (when `canSubmit` is false).

---

#### API unavailable / error surfacing

- With the **frontend up** and **`moon-api` stopped**, fill valid inputs and click **Compute** → an error appears in **`[role="alert"]`** with text indicating **cannot reach** / **port 8080** / **proxy** (matches user-facing copy in [`api.ts`](src/frontend/src/api.ts)).
- Optional: mock or block `/api/moon` at the network layer to force **HTTP 400** and assert the API **`error`** message appears in the alert region.

---

#### Accessibility (recommended E2E checks)

- **`h1`** is unique; form fields have associated **labels** (`label[for=lat]` etc.).
- On error, the message is inside **`[role="alert"]`** so assistive tech picks it up.

---

#### Docker / deployed URL E2E

- Target **`http://localhost:<mapped-port>`** (no Vite): repeat **happy path** and **error** scenarios if you expose a way to stop only the API (otherwise skip “API down” or run against a bad port).

---

#### What E2E usually does *not* replace

- **Precise ephemeris values** vs NASA: too brittle; rely on **unit** golden tests for math.
- **Every HTTP 400 variant**: better covered in **integration** API tests; E2E can sample one **400** path via UI if the UI ever exposes it (current MVP mostly validates client-side and generic API errors).

---

*Implement with stable **`data-testid`** attributes only if selectors are flaky; prefer visible text and roles aligned with [`App.tsx`](src/frontend/src/App.tsx) and [`App.css`](src/frontend/src/App.css).*
