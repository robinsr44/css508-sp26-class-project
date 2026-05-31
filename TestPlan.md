# Test plan

This document is the **test plan** for the **moon tracker** class project: a React + TypeScript client and a C++ `moon-api` service. It turns the goals in [TestStrategy.md](TestStrategy.md) into **planned activities**, **environments**, and **checklists** (unit, integration, E2E). Functional definitions and API contracts are authoritative in [README.md](README.md) and [Design.md](Design.md). Browser E2E detail and run commands live in [E2ETestPlan.md](E2ETestPlan.md).

---

## 1. Document control

| Item | Value |
|------|--------|
| **Purpose** | Plan what to test, how, and when; record pass/fail criteria for releases and coursework milestones. |
| **Related documents** | [TestStrategy.md](TestStrategy.md), [E2ETestPlan.md](E2ETestPlan.md), [Design.md](Design.md), [README.md](README.md) |
| **Revision** | Update when routes, JSON shapes, or deployment paths change. |

---

## 2. Items under test

| ID | Feature / component | Source of truth |
|----|---------------------|-----------------|
| **T1** | Lunar ephemeris: phase, illumination, moonrise/moonset (UTC day), polar states | `moon_ephemeris`, README “Time and semantics” |
| **T2** | Solar ephemeris: azimuth and altitude at instant | `moon_ephemeris`, README `/api/sun` |
| **T3** | Input parsing and validation: lat/lon bounds, `YYYY-MM-DD`, `HH:MM` UTC | `main.cpp`, README query/body tables |
| **T4** | HTTP API: `GET`/`POST` `/api/moon`, `/api/sun`; `GET` `/api/health`, `/api/version`; errors 400/500 | README API reference |
| **T5** | CORS and `OPTIONS` for documented `/api/*` routes | README, Design |
| **T6** | Frontend: observation form, parallel moon+sun fetch, errors, timezone display, copy/URL helpers | Design “Client” |
| **T7** | Container: nginx static + `/api` proxy, process startup | `Dockerfile`, `docker/`, README Docker |

---

## 3. Test environments

| Environment | Purpose | Notes |
|-------------|---------|--------|
| **Local dev** | Developer iteration | `moon-api` on chosen port; Vite dev server with `/api` proxy (README). |
| **API-only** | Contract and ephemeris checks | `curl` / scripts against `http://127.0.0.1:<port>`; no UI. |
| **Docker Compose** | Production-like smoke | Host port mapped to container (README); `/api` same origin as UI. |
| **CI (recommended)** | Repeatable gates | [`.github/workflows/ci.yml`](.github/workflows/ci.yml): frontend lint/tests, backend **ctest** + moon-api TCP smoke, Docker compose smoke. [`.github/workflows/e2e.yml`](.github/workflows/e2e.yml): Playwright against live **`moon-api`** (see §4.4). |

**Test data:** Use fixed **fixtures** (known lat/lon/date/time and expected outcomes) in C++/TS tests or scripts; align with [TestStrategy.md](TestStrategy.md) under **Unit tests** (backend and frontend). Record **tolerance** for floating-point comparisons in test code or comments.

---

## 4. Test levels

Structure matches [TestStrategy.md](TestStrategy.md) **§ Test levels**: unit (backend and frontend), integration, E2E (Playwright; see §4.4), and metrics.

Priorities (below): **P0** = must pass for any merge/demo; **P1** = should pass before milestone complete; **P2** = nice to have.

### 4.1 Unit tests — Backend (C++)

**Coverage target:** All public ephemeris entry points and parsing happy/sad paths; HTTP behavior via **`moon_ephemeris_tests`** and **`moon_api_tests`** (in-process **`httplib`**; same sources as `moon-api`). See TestStrategy **Unit tests → Backend**.

| Type | Focus |
|------|--------|
| Ephemeris & parsing | `moon_ephemeris`, date/time helpers |
| HTTP routes | Status codes, JSON shape, GET vs POST parity, CORS/`OPTIONS` — largely **`moon_api_tests`** |

#### 4.1.1 Ephemeris and parsing (automated when tests exist)

| Case ID | Priority | Description | Expected result |
|---------|----------|-------------|-----------------|
| BE-01 | P0 | `compute_full` for mid-latitude fixture (normal visibility) | Phase name and illumination within tolerance; `visibility.state` is `normal` when rise/set expected for fixture. |
| BE-02 | P1 | High-latitude fixture where README allows `always_up` / `always_down` | Correct `visibility.state`; no crash. |
| BE-03 | P1 | Leap day / month boundary UTC instants | Parsed instant consistent; no invalid date acceptance. |
| BE-04 | P0 | `parse_date` / `parse_time_hh_mm` invalid inputs | Rejection or error path used by callers; no undefined behavior. |
| BE-05 | P1 | `compute_sun_full` same instant as moon fixture | Altitude/azimuth in plausible ranges; deterministic across runs. |

#### 4.1.2 HTTP API (`moon_api_tests` and optional `curl`)

| Case ID | Priority | Description | Expected result |
|---------|----------|-------------|-----------------|
| HTTP-01 | P0 | `GET /api/health` | **200**, JSON includes `status` (e.g. `ok` per README). |
| HTTP-02 | P0 | `GET /api/version` | **200**, `service` and `version` present. |
| HTTP-03 | P0 | `GET /api/moon` with valid `lat`, `lon`, `date`, optional `time` | **200**; body includes `instant_utc`, `location`, `phase`, `illumination`, `visibility`. |
| HTTP-04 | P0 | `POST /api/moon` with same parameters as HTTP-03 | **200**; semantically same as GET within float tolerance. |
| HTTP-04b | P1 | `GET`/`POST` `/api/sun` parity | Same azimuth/altitude within tolerance (`MoonApiParity.GetAndPostSunMatchPosition`). |
| HTTP-04c | P1 | `GET /api/moon` with `time` omitted | Same `instant_utc` as explicit `time=12:00` (`MoonApiGetMoon.DefaultTimeMatchesExplicitNoon`). |
| HTTP-05 | P0 | `GET` / `POST` `/api/sun` valid params | **200**; `position.azimuth_deg`, `position.altitude_deg` present. |
| HTTP-06 | P0 | Missing required parameter (e.g. no `date`) | **400**, `{"error":"..."}`. |
| HTTP-07 | P1 | Out-of-range `lat` or `lon` | **400** with clear error. |
| HTTP-08 | P1 | Malformed `date` or `time` string | **400**. |
| HTTP-09 | P2 | `OPTIONS` on `/api/moon` (and other documented routes) | Success for preflight as used by browsers. |

---

### 4.2 Unit tests — Frontend (TypeScript)

**Coverage target:** `locationTime.ts`, `api.ts`, and similar pure modules; components with mocked **`fetch`**. See TestStrategy **Unit tests → Frontend**.

| Case ID | Priority | Description | Expected result |
|---------|----------|-------------|-----------------|
| FE-01 | P0 | Submit with empty required fields | Submit disabled or validation message; no request. |
| FE-02 | P0 | Successful fetch | Moon and sun sections show data; no error banner. |
| FE-03 | P0 | API returns **400** or network failure | User-visible error from API body or generic message. |
| FE-04 | P1 | Timezone resolution success | Local time labels shown per Design. |
| FE-05 | P1 | Timezone lookup failure | Graceful UTC-only wording (Design). |
| FE-06 | P2 | Copy URL / curl helpers | **Deferred** — not implemented in current `App.tsx` (see Design vs shipped UI). |
| FE-07 | P1 | Nominatim empty / HTTP / network failure | Error copy in `App.locationSearch.test.tsx`. |
| FE-08 | P1 | Geolocation denied / unavailable / not supported | Error copy in `App.geolocation.test.tsx`. |
| FE-09 | P1 | Invalid lat/lon, loading state, failed re-submit | `App.formUx.test.tsx`. |
| FE-10 | P1 | `fetchSun` HTTP/network/shape errors | `api.test.ts`. |

---

### 4.3 Integration tests

**Coverage target:** Multiple real layers (see TestStrategy **Integration tests**): HTTP contract against a **running** `moon-api` (optional **`curl`**/scripts beyond **`moon_api_tests`**); optional **Vite** + live **`moon-api`** for real `/api` from the browser; **Docker** smoke for nginx + API + static UI.

#### 4.3.1 Docker / deployment smoke

| Case ID | Priority | Description | Expected result |
|---------|----------|-------------|-----------------|
| DO-01 | P0 | `docker compose up --build` (or documented equivalent) | Container serves UI; `/api/health` returns OK. |
| DO-02 | P0 | `GET` sample `/api/moon` through mapped port | **200** and valid JSON. |

#### 4.3.2 Optional manual / scripted checks

| Check | Notes |
|-------|--------|
| **HTTP black-box** | Same expectations as §4.1.2 against a process bound to a fixed port (CI or local). |
| **Vite + `moon-api`** | Confirm `/api` proxy and paths when unit tests with mocks are insufficient. |

---

### 4.4 E2E tests (Playwright)

**Coverage target:** Real **Chromium** sessions against **Vite** with **`moon-api` on 8080** (same proxy layout as local dev). Automated specs live under [`src/frontend/e2e/`](src/frontend/e2e/). Full suite breakdown, Vitest vs Playwright scope, and local commands: [E2ETestPlan.md](E2ETestPlan.md).

**CI:** Pull requests run functional **`npm run test:e2e:ci`** in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) and [`.github/workflows/e2e.yml`](.github/workflows/e2e.yml) (builds `moon-api`, starts it on **8080**, installs Chromium). Automated accessibility Playwright specs run in [`.github/workflows/specialized-testing.yml`](.github/workflows/specialized-testing.yml) via **`npm run test:specialized:a11y`**.

| Case ID | Priority | Spec / focus | Description | Expected result |
|---------|----------|----------------|-------------|-----------------|
| **E2E-01** | P0 | [`smoke.spec.ts`](src/frontend/e2e/smoke.spec.ts) — smoke | Seattle lat/lon, date **2026-04-05**, UTC **12:00** → **Compute** | **Phase** heading, **`.moon-phase-svg`**, **Sun position** heading visible; **Illumination** shows **Local time**, **UTC** pill toggles **UTC:** line, **Local** restores local line (live **`/api/moon`** & **`/api/sun`** via proxy). |
| **E2E-02** | P1 | [`smoke.spec.ts`](src/frontend/e2e/smoke.spec.ts) — geocoder stub | City search with **`**/nominatim.openstreetmap.org/search**`** fulfilled as a fake Paris hit | Latitude/longitude inputs match stub (**48.8566**, **2.3522**); no real OSM call. |
| **E2E-03** | P1 | [`accessibility.spec.ts`](src/frontend/e2e/accessibility.spec.ts) | Same compute fixture as E2E-01, then **`@axe-core/playwright`** (`AxeBuilder`) | **Zero** axe violations with **`color-contrast`** disabled (intentional for dark-theme demos; see E2E test plan). |
| **E2E-04** | P1 | [`smoke.spec.ts`](src/frontend/e2e/smoke.spec.ts) — visibility | After compute, **Visibility** shows rise/set, hours line, or polar copy; **UTC** pill updates moonrise/moonset and **Sun position** labels. |
| **E2E-05** | P1 | [`failure.spec.ts`](src/frontend/e2e/failure.spec.ts) | Stub **`/api/moon`** **400** | **`role="alert"`** shows API error; no **Phase** heading. |
| **E2E-06** | P1 | [`location-search-failure.spec.ts`](src/frontend/e2e/location-search-failure.spec.ts) | Stub Nominatim empty / **503** | User-visible geocoder error copy. |
| **E2E-07** | P2 | [`keyboard.spec.ts`](src/frontend/e2e/keyboard.spec.ts) | Tab + **Enter** on **Compute**; keyboard **UTC** pill | Results render; time label toggles. **Color-contrast** remains disabled in axe. |
| **E2E-08** | P2 | CI **`container`** job + [`docker-playwright.sh`](scripts/ci/docker-playwright.sh) | Playwright vs **Compose/nginx** on **8080** | Smoke + failure specs pass through packaged proxy. |
| **MAN-01** | P2 | Manual (documented in [E2ETestPlan.md](E2ETestPlan.md) Suite B) | Spot-check moon disk visuals across cycle | Not CI; 29-day Vitest covers labels only. |

**Global setup:** [`global-setup.ts`](src/frontend/e2e/global-setup.ts) asserts **`moon-api`** health before tests (default **`MOON_API_HEALTH_URL`**).

---

### 4.5 Metrics

**Coverage target:** Performance and operations metrics (API timing, startup, bundle size, uptime, visitors, etc.) are defined in [TestStrategy.md](TestStrategy.md) **§ Metrics**. Record baselines when the course or deployment requires them.

---

## 5. Execution schedule (suggested)

| Phase | Activities | Exit criterion |
|-------|--------------|----------------|
| **A — Core correctness** | Implement BE-01–BE-05, HTTP-01–HTTP-08 as automated tests where feasible | Ephemeris and API behaviors reproducible in CI or documented manual script. |
| **B — UI and integration** | FE-01–FE-05; Vitest suites with mocked HTTP; Playwright **E2E-01**–**E2E-03** in CI (**`e2e.yml`**); **DO-01**–**DO-02** for Docker smoke | Demo path works on local dev and Docker; packaged stack responds to health and sample moon; browser E2E passes against live API in CI. |
| **C — Hardening** | BE-02 polar cases, HTTP-09, FE-06; fuzz a small set of bad inputs | No crashes; errors remain JSON-shaped. |

Adjust phases to match course deadlines; **P0** cases should complete before final demo.

---

## 6. Entry and exit criteria

### 6.1 Entry (start testing a build)

- Code compiles: C++ `cmake` build; frontend `npm run build`.
- For API cases: `moon-api` running on a known port (or Docker stack up).
- Baseline fixtures checked in or documented for reproducibility.

### 6.2 Exit (ready for demo / submission)

- All **P0** automated cases pass (or P0 manual checklist signed off if automation is not yet implemented).
- No open **P0** defects for routes documented in README.
- **P1** failures documented with rationale or follow-up issues.

---

## 7. Roles and responsibilities (typical for a small team)

| Role | Responsibility |
|------|----------------|
| **Implementer** | Write features; add or update tests per this plan; fix failures. |
| **Reviewer** | Confirm P0 cases exist for changed areas; spot-check README vs behavior. |
| **Course / PM** | Accept exit criteria for graded milestones. |

For a solo project, one person covers all roles but still uses the checklists.

---

## 8. Deliverables

| Deliverable | Description |
|-------------|-------------|
| Automated tests | C++ test binaries / `ctest` (`moon_ephemeris_tests`, `moon_api_tests`); frontend **Vitest** suite; **Playwright** specs under `src/frontend/e2e/`; optional **`curl`**/API scripts. |
| CI configuration | **GitHub Actions**: [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (frontend, backend, Docker smoke); [`.github/workflows/e2e.yml`](.github/workflows/e2e.yml) (Playwright E2E). See [TestStrategy.md](TestStrategy.md) § Automation Strategies. |
| Runbook | README + [E2ETestPlan.md](E2ETestPlan.md) for Vitest vs Playwright; this plan updated if cases change. |
| Metrics baselines (optional) | If required for the course or a public deployment: capture entries from [TestStrategy.md](TestStrategy.md) § Metrics (e.g. API timing, uptime, visitor counts). |

---

## 9. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Float drift across platforms | Fix tolerance; avoid over-precise golden values from external almanacs. |
| No CI | Run P0 matrix manually before each submission; add CI when time allows. |
| E2E flakiness | Prefer API/unit tests for contracts; Playwright uses fixed fixtures + health gate in **`global-setup`**; keep additional browser cases stable and minimal. |
| Semantic misunderstanding (UTC day vs local) | Anchor tests to README “Time and semantics”; add fixture comments. |

---

## 10. Traceability

| Strategy objective | Plan sections |
|--------------------|----------------|
| Correctness | §2 T1–T4, §4.1–§4.2 case matrices |
| Regression safety | §4.1–§4.2 |
| Integration (HTTP, FE+API, Docker smoke, browser E2E) | §3 environments, §4.3, §4.4, §5 phase B |
| Fast feedback | §4.1–§4.2, §5 phase A |
| Performance / operations metrics | [TestStrategy.md](TestStrategy.md) § Metrics; §4.5; optional baselines in §8 |

---

## 11. Change log

| Date | Change |
|------|--------|
| *(initial)* | Test plan created; aligned with TestStrategy and README/Design. |
| 2026-04-19 | Aligned with TestStrategy; restructured **§4** into **Test levels** (unit backend, unit frontend, integration, optional E2E, metrics) matching [TestStrategy.md](TestStrategy.md); integration/FE+API/Docker in schedule; Vitest/ctest deliverables; traceability and fixture reference updates; renumbered §5–§11. |
| 2026-05-17 | **§4.4** expanded with Playwright cases **E2E-01**–**E2E-03** (smoke, stubbed Nominatim, axe); CI/env/deliverables/traceability updated for **`ci.yml`** + **`e2e.yml`**; cross-link [E2ETestPlan.md](E2ETestPlan.md). |
