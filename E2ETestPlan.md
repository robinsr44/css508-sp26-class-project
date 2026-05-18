# E2E Test Plan

Automation spans **two layers**:

1. **Vitest + Testing Library** — full `App` render with mocked `fetch` (fast, deterministic).
2. **Playwright + Chromium** — real browser against **live `moon-api`** (and optionally stubbed third-party routes).

---

## How to run

| Layer | Working directory | Command | Prerequisites |
|--------|-------------------|---------|----------------|
| Vitest component tests | `src/frontend/` | `npm test` | None |
| Playwright browser tests | `src/frontend/` | One-time: `npm run test:e2e:install` → then `npm run test:e2e` | **`moon-api` listening on port 8080** so Vite’s `/api` proxy succeeds |

Optional UI debug: `npm run test:e2e:ui`.

**Docker Compose** (UI + API on host **8080**): skip Playwright’s embedded Vite and point at nginx:

```bash
cd src/frontend
PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080 npm run test:e2e
```

(`global-setup` still hits **`MOON_API_HEALTH_URL`** — default `http://127.0.0.1:8080/api/health`.)

---

## Vitest suites (mocked HTTP)

Implementation references:

| Suite | File |
|-------|------|
| Location search + moon cycle | [`src/frontend/src/App.happyPath.test.tsx`](src/frontend/src/App.happyPath.test.tsx) |
| Moon/sun partial failure | [`src/frontend/src/App.resilience.test.tsx`](src/frontend/src/App.resilience.test.tsx) |
| Geolocation button | [`src/frontend/src/App.geolocation.test.tsx`](src/frontend/src/App.geolocation.test.tsx) |
| Golden astrometry mirror | [`src/frontend/src/test/ephemerisMirror.ts`](src/frontend/src/test/ephemerisMirror.ts) |

### Suite A — Location search → coordinates

**Goal:** Choosing a geocoder hit updates latitude/longitude (`toFixed(4)`).

**Cases:** Richmond VA, Oslo, Sydney — mocked Nominatim JSON.

### Suite B — Moon cycle (~29 days)

**Goal:** Seattle `47.6062`, `-122.3321`, UTC `12:00`, dates **2026-01-15 … 2026-02-12**: phase label (including **Full** illumination override), sun altitude/azimuth strings, illumination **Local** / **UTC** / **Local** toggle matches `formatInstantForDisplay`.

**Golden:** responses built via **`buildMoonSunGoldenResponses`** (aligned with **`moon_ephemeris.cpp`**).

### Suite C — API resilience (`Promise.all`)

**Goal:** Submit calls moon and sun together; either failure surfaces **`role="alert"`** and **no** partial results panel for moon/sun headings.

| Case | Expect |
|------|--------|
| Moon **400**, sun **200** | Error text from moon; no Phase heading |
| Moon **200**, sun **502** | Error text from sun; no Phase / Sun position headings |

### Suite D — Use my location

**Goal:** Stub **`navigator.geolocation.getCurrentPosition`** → lat/lon inputs filled (`40.7128`, `-74.0060`) and **Compute** still works with mocked `/api/moon` & `/api/sun`.

---

## Playwright suites (real backend + Chromium)

Config: [`src/frontend/playwright.config.ts`](src/frontend/playwright.config.ts)  
Specs: [`src/frontend/e2e/`](src/frontend/e2e/)

### Suite E — Smoke (`smoke.spec.ts`)

**Live `/api/moon` & `/api/sun`** via Vite proxy:

1. Open `/`, fill Seattle coords, date **2026-04-05**, UTC **12:00**.
2. **Compute** → **Phase** heading, `.moon-phase-svg`, **Sun position** heading visible.
3. Illumination block: **Local time** visible → pill **UTC** → **UTC:** line → **Local** restores local line.

### Suite F — Location search with stubbed Nominatim (`smoke.spec.ts`)

Intercepts **`**/nominatim.openstreetmap.org/search**`** with a fake Paris hit — asserts coords fill **without** calling real OSM.

### Suite G — Accessibility (`accessibility.spec.ts`)

After successful compute, runs **`@axe-core/playwright`** **`AxeBuilder`** with **`color-contrast`** disabled (dark-theme demos often violate strict contrast budgets). Expect **zero** remaining violations.

---

## Scope summary

| Topic | Vitest | Playwright |
|-------|--------|------------|
| DOM / React wiring | Yes | Yes |
| Live moon-api & proxy | Mocked | Yes |
| Real Chromium layout | jsdom only | Yes |
| Nominatim | Mocked | Stubbed route (one test) |
| Keyboard / a11y axe | Partial | Yes |

---

## Related documentation

- Moon disk behavior: [`Design.md`](Design.md).
- Project test strategy: [`TestStrategy.md`](TestStrategy.md).

## CI (GitHub Actions)

Pull-request workflows:

**[`ci.yml`](.github/workflows/ci.yml)** — unit/integration-style checks:

| Job | Role |
|-----|------|
| **frontend** | `npm ci`, `npm run lint`, **`npm test`** (Vitest, including happy-path / resilience tests). |
| **backend** | CMake build, **ctest**, moon-api TCP smoke on **19090**. |
| **container** | Docker image build + compose smoke. |

**[`e2e.yml`](.github/workflows/e2e.yml)** — browser E2E (runs in parallel with CI jobs):

| Job | Role |
|-----|------|
| **playwright** | CMake **build** `moon-api` only (no **ctest** here; backend job covers tests), runs it on **8080**, **`npm ci`** + **`npx playwright install chromium --with-deps`**, **`npm run test:e2e`** (Playwright starts Vite on **5173**). On failure, uploads **`playwright-report`** artifact for debugging. |

Vitest does **not** require `moon-api`. Playwright uses a locally built **`moon-api`** in this workflow (live `/api` traffic).
