# Test strategy

This document describes how to test the **moon tracker** project: a **React + TypeScript** SPA (`src/frontend/`) that calls a **stateless C++ REST API** (`moon-api`, `src/backend/`). Broader behavior and API contracts are defined in [README.md](README.md) and [Design.md](Design.md).

---

## Objectives

1. **Correctness** — Lunar and solar outputs match the intended **UTC instant** and **UTC-day** rise/set semantics documented in the README; invalid inputs are rejected with stable JSON error shapes.
2. **Regression safety** — Changes to `moon_ephemeris` or HTTP handlers do not silently alter numeric outputs or response JSON without review.
3. **Integration confidence** — The UI and API work together through the same paths used in development (Vite proxy) and production (nginx + `/api`).
4. **Fast feedback** — Automated tests run locally and in CI in minutes; slow checks are limited and labeled.

---

## Scope

| In scope | Out of scope |
|----------|----------------|
| `moon_ephemeris` math and parsing helpers | Sub-arcminute astronomical accuracy; comparison to professional ephemerides |
| HTTP routes: `/api/health`, `/api/version`, `/api/moon`, `/api/sun` (GET and POST) | Weather, extinction, or “visible in darkness” |
| Request validation (coordinates, date, time) and error responses | Load/stress testing unless explicitly required |
| Frontend: form validation, API client behavior, timezone display helpers | Visual regression unless tooling is adopted |
| Docker image build and **smoke** checks (`/api/health`, sample `/api/moon`) | Penetration testing beyond basic input fuzzing |

---

## Test levels

### 1. Unit tests — backend (C++)

**Primary targets:** `moon_ephemeris` (pure functions, no I/O) and small helpers shared with `main.cpp` where practical.

- **Determinism:** Same inputs → same floating-point outputs within a documented tolerance (ephemeris is **UI-grade**, not navigation-grade).
- **Representative cases:**
  - Mid-latitude location with **normal** visibility (moonrise/moonset present).
  - Polar or high-latitude cases yielding **`always_up`** / **`always_down`** when applicable.
  - Edge dates (leap years, month boundaries) and default time behavior (`12:00` UTC when omitted).
- **Sun path:** `compute_sun_full` / `sun_position` — azimuth and altitude ranges and consistency with the same instant as moon calls.
- **Parsing:** `parse_date`, `parse_time_hh_mm`, and ISO-8601 formatting helpers reject invalid strings and accept documented formats.

**Tooling:** Add a test executable or `ctest` target (e.g. **GoogleTest** or **Catch2**) in CMake; link the same `moon_ephemeris` sources used by `moon-api`.

### 2. Unit tests — frontend (TypeScript)

**Primary targets:** Pure logic with no astronomy in the browser.

- **`locationTime.ts` (and similar):** IANA resolution via `tz-lookup`, fallback when lookup fails, `Intl` formatting of UTC strings from the API.
- **`api.ts`:** URL construction, query serialization, error handling from `fetch` (status not ok, JSON error body).
- **Components (optional):** Form validation messages, loading and error states, using mocked `fetch` or injected clients.

**Tooling:** **Vitest** (fits Vite) or **Jest** with **jsdom**; keep tests colocated or under `src/frontend/src/**/*.test.ts(x)`.

### 3. API / contract tests

**Goal:** Verify HTTP behavior without going through the React bundle.

- **Happy paths:** `GET` and `POST` for `/api/moon` and `/api/sun` return **200** and JSON matching the documented shapes (required keys, types, `visibility.state` enum).
- **Validation:** Missing/invalid `lat`/`lon`/`date`/`time` → **400** with `{"error":"..."}`.
- **Parity:** For equivalent parameters, `GET` and `POST` bodies agree within floating-point tolerance.
- **CORS / OPTIONS:** Preflight succeeds for documented routes if browsers are a supported client.

**How:** Shell scripts with `curl` and `jq`, or a small Node/Python harness, or a dedicated test framework. Run against a **locally started** `moon-api` (fixed port) in CI.

### 4. End-to-end (E2E) tests (optional)

**Goal:** One or two flows through the real stack.

- Start `moon-api` and either Vite dev or `vite preview` + proxy, or **Docker Compose** on a CI port.
- **Playwright** or **Cypress:** submit coordinates and date, assert visible phase/illumination labels and absence of error banner for a known-good fixture.

Use sparingly; prefer API + unit tests for most changes.

### 5. Build and deployment smoke tests

- **Backend:** `cmake` configure + build succeeds; optional `ctest` after unit tests exist.
- **Frontend:** `npm run build` succeeds (catches TypeScript and bundling issues).
- **Docker:** `docker compose build` (or `docker build`) succeeds; container responds with `GET /api/health` → `{"status":"ok"}` and a sample `/api/moon` returns **200**.

---

## Priorities (risk-based)

1. **Ephemeris and UTC-day semantics** — Highest impact; bugs here invalidate all clients.
2. **HTTP validation and JSON contracts** — Prevents bad data from reaching core logic and keeps the UI stable.
3. **Frontend time display and API client** — User-visible; test pure functions first, then one integration path.
4. **E2E and Docker smoke** — Add when core layers are covered or before release milestones.

---

## Test data and fixtures

- Store **fixed** `(lat, lon, date, time)` fixtures with **expected** phase names, approximate illumination, and visibility state in versioned files (JSON or C++ constants).
- Document **tolerance** for floats (e.g. illumination percent, hours above horizon).
- Prefer **UTC** strings from the API as golden references for rise/set rather than third-party almanacs (semantics are project-specific).

---

## Continuous integration (recommended)

A minimal pipeline would:

1. Configure and build the C++ project; run backend unit tests when present.
2. `npm ci` and `npm run build` under `src/frontend/`; run frontend unit tests when present.
3. Optionally build the Docker image and run smoke `curl` checks.

Run API contract tests after step 1 with `moon-api` started in the background.

---

## Maintenance

- Update this strategy when adding routes, changing JSON shapes, or introducing persistence/auth.
- Any change to **time semantics** (UTC day for rise/set, default `time`) should include **new or updated fixtures** and a short note in the PR.
