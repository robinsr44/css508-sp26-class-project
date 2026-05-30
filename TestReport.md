# Automated test report

This document summarizes automated test coverage and the **latest local verification run** captured when this report was generated. Re-run the commands in [How to reproduce](#how-to-reproduce) before releases or graded submissions to refresh counts.

---

## Executive summary

| Layer | Runner | Tests (last run) | Failed | Overall |
|--------|--------|------------------|--------|---------|
| Frontend unit / integration | Vitest (jsdom + Testing Library) | 66 | 0 | Passed |
| Backend unit / integration | CTest / Google Test | 2 suites (executables), all cases | 0 | Passed |
| Browser E2E | Playwright (Chromium) | 3 | 0 | Passed |

**Last local run recorded in this report:** 2026-05-18 (Vitest JSON + CTest + Playwright on this workspace).

---

## Frontend — Vitest

**Working directory:** `src/frontend`  
**Command:** `npm test` (`vitest run`)  
**Config:** [`src/frontend/vite.config.ts`](src/frontend/vite.config.ts) — patterns `src/**/*.test.ts`, `src/**/*.test.tsx`.

| Test file | Role | Tests (approx.) |
|-----------|------|-----------------|
| [`App.test.tsx`](src/frontend/src/App.test.tsx) | Forms, mocked API, phase label corrections, timezone edge | 8 |
| [`App.happyPath.test.tsx`](src/frontend/src/App.happyPath.test.tsx) | Suite A/B (see [`E2ETestPlan.md`](E2ETestPlan.md)): Nominatim search + ~29‑day Seattle moon/sun golden rows | 32 |
| [`App.resilience.test.tsx`](src/frontend/src/App.resilience.test.tsx) | Suite C — `Promise.all` moon+sun failures | 2 |
| [`App.geolocation.test.tsx`](src/frontend/src/App.geolocation.test.tsx) | Suite D — “Use my location” | 1 |
| [`api.test.ts`](src/frontend/src/api.test.ts) | `fetchMoon` / `fetchSun` / `fetchVersion` parsing & errors | 14 |
| [`locationTime.test.ts`](src/frontend/src/locationTime.test.ts) | Time zone helpers & formatting | 9 |

**Last run totals:** 66 passed, 0 failed, 0 skipped (Vitest `--reporter=json`).

---

## Backend — CTest

**Configure / build:** `cmake -S src/backend -B <build-dir>` then `cmake --build <build-dir>`  
**Command:** `ctest --test-dir <build-dir>`  

**Last run:**

| # | Executable | Result | Wall time |
|---|------------|--------|-----------|
| 1 | `moon_ephemeris_tests` | Passed | ~0.14 s |
| 2 | `moon_api_tests` | Passed | ~0.19 s |

Additional black-box TCP checks (`scripts/ci/moon-api-smoke.sh`) run in CI on the **`moon-api`** binary (see [.github/workflows/ci.yml](.github/workflows/ci.yml)).

---

## Browser E2E — Playwright

**Working directory:** `src/frontend`  
**Specs:** [`src/frontend/e2e/`](src/frontend/e2e/) • **Config:** [`playwright.config.ts`](src/frontend/playwright.config.ts)  
**Correlation with [E2ETestPlan.md](E2ETestPlan.md):** Suites **E**, **F**, and **G** below.

---

### Pre-flight (`global-setup.ts`)

Runs once before browser workers start (not counted in the three test-case totals):

| Step | Behaviour |
|------|-----------|
| Health probe | `GET` `MOON_API_HEALTH_URL` (default `http://127.0.0.1:8080/api/health`). |
| Body check | Expects JSON `{ "status": "ok" }` and HTTP success. |
| Failure gate | Aborts startup if unreachable within ~5 s — ensures Vite’s `/api` proxy has a backing `moon-api`. |

---

### Suite E — Smoke compute + results UI (`e2e/smoke.spec.ts`)

**Test:** `moon tracker smoke › compute shows moon phase, SVG disk, and sun position`  
**Purpose:** One full **Compute** against **live** `/api/moon` & `/api/sun` (via Vite proxy); validates primary result landmarks and illumination time toggles.

**Fixed inputs**

| Field | Value |
|--------|--------|
| Latitude | `47.6062` (Seattle) |
| Longitude | `-122.3321` |
| Date | `2026-04-05` |
| Time (UTC) | `12:00` |

**Scenario**

1. Open `/`; assert heading **Moon tracker** visible.
2. Fill latitude, longitude, date, **Time (UTC)**; click **Compute**.
3. **Moon / sun results:** heading **Phase** visible; `.moon-phase-svg` visible; heading **Sun position** visible.
4. **Illumination block:** (container under heading **Illumination**)
   - Default: copy matching **`Local time:`**.
   - Click pill **UTC** → line matching **`UTC:`**.
   - Click pill **Local** → **`Local time:`** visible again.

**Checks:** SPA shell → successful compute → phase + SVG + sun + illumination **Local ⇄ UTC** behaviour on real ephemeris JSON.

---

### Suite F — Geocoder stub (`e2e/smoke.spec.ts`)

**Test:** `moon tracker smoke › location search fills coordinates when Nominatim returns a hit`  
**Purpose:** Location search wired to coordinates **without** calling real OSM **Nominatim**.

**Scenario**

1. Open `/`.
2. `page.route("**/nominatim.openstreetmap.org/search**")` fulfills `200` with JSON `[{ lat: "48.8566", lon: "2.3522", display_name: "Paris, France" }]`.
3. Search box (placeholder `/city/i`) → `Paris`; click **Search**.
4. **Expect:** latitude `48.8566`, longitude `2.3522` in the labelled inputs.

**Checks:** Mocked HTTP path only; verifies parse + form fill behaviour.

---

### Suite G — Accessibility (`e2e/accessibility.spec.ts`)

**Test:** `accessibility › axe reports no violations (excluding color-contrast) after compute`  
**Purpose:** **Deque Axe** scan on the post-compute page (`@axe-core/playwright` / `AxeBuilder`).

**Scenario**

1. Same coordinates and date/time as Suite E → **Compute** → **Phase** heading visible.
2. Run `AxeBuilder({ page }).disableRules(["color-contrast"]).analyze()`.
3. **Expect:** `results.violations` is **`[]`**; non-empty violations fail with JSON dumped in the assertion (for debugging).

| Detail | Reason |
|--------|--------|
| `color-contrast` disabled | Reduces noise for intentional dark-theme course UI (matches spec comments). |

**Checks:** No other Axe rule violations once results are rendered.

---

### E2E summary table

| ID | Suite | Spec file | Automated cases |
|----|-------|-----------|-----------------|
| — | Pre-flight | [`e2e/global-setup.ts`](src/frontend/e2e/global-setup.ts) | Health gate (once per run) |
| E | Smoke compute | [`e2e/smoke.spec.ts`](src/frontend/e2e/smoke.spec.ts) | 1 |
| F | Location stub | [`e2e/smoke.spec.ts`](src/frontend/e2e/smoke.spec.ts) | 1 |
| G | A11y axe | [`e2e/accessibility.spec.ts`](src/frontend/e2e/accessibility.spec.ts) |
| H | Manual Testing | See Manual E2E Testing - Moon Phase Detection.pdf | 31 |
1 |

**Last run totals (snapshot in executive summary):** 3 Playwright tests passed; 0 failed (`playwright test --reporter=list`).

**Verbose / multi-reporter locally**

```bash
cd src/frontend
npx playwright test --reporter=list,line --workers=1
npx playwright test --reporter=html,line    # opens `playwright-report/` when CI uploads or run locally
```

**Prerequisites:** `moon-api` must match **`vite.config.ts`** proxy (**port 8080** default); override health URL with **`MOON_API_HEALTH_URL`** for [`global-setup.ts`](src/frontend/e2e/global-setup.ts). See **[E2ETestPlan.md](E2ETestPlan.md)** for Docker / `PLAYWRIGHT_SKIP_WEBSERVER` variants.

---

## CI / CD mapping

| Workflow | What runs |
|----------|-----------|
| [.github/workflows/ci.yml](.github/workflows/ci.yml) | Frontend: `npm run lint`, `npm test`, Playwright (see job steps). Backend: full CMake build, **ctest**, moon-api smoke. Container: Docker compose smoke. |
| [.github/workflows/e2e.yml](.github/workflows/e2e.yml) | Dedicated Playwright job (build `moon-api`, health on 8080, `npm run test:e2e`, upload report on failure). |

---

## How to reproduce

```bash
# Frontend — Vitest (+ optional JSON summary)
cd src/frontend && npm ci && npm test

# Backend — from repo root
cmake -S src/backend -B build && cmake --build build -j"$(nproc || sysctl -n hw.ncpu)"
ctest --test-dir build --output-on-failure

# Playwright — start moon-api on 8080, then (from E2ETestPlan):
cd src/frontend && npm run test:e2e:install && npm run test:e2e
```

To write a machine-readable Vitest summary:

```bash
cd src/frontend
npx vitest run --reporter=json --outputFile=test-results/vitest-report.json
```

(`src/frontend/test-results/` is gitignored.)

---

## Related documents

- [E2ETestPlan.md](E2ETestPlan.md) — Suite A–G mapping (Vitest vs Playwright).  
- [TestStrategy.md](TestStrategy.md) — Project-wide testing approach.  
- [TestPlan.md](TestPlan.md) — Broader test plan references.
