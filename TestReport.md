# Automated test report

This document summarizes automated test coverage and the **latest local verification run** captured when this report was generated. Re-run the commands in [How to reproduce](#how-to-reproduce) before releases or graded submissions to refresh counts.

---

## Executive summary

| Layer | Runner | Tests (last run) | Failed | Overall |
|--------|--------|------------------|--------|---------|
| Frontend unit / integration | Vitest (jsdom + Testing Library) | 39 | 0 | Passed |
| Backend unit / integration | CTest / Google Test | 2 suites, all cases | 0 | Passed |
| Live API fixture | `live-moon-fixture.sh` | 1 check | 0 | Passed |
| API smoke (extended) | `moon-api-smoke.sh` | 8 checks | 0 | Passed |
| Browser E2E | Playwright (Chromium) | 4 | — | Run in CI (`e2e.yml`) |
| Docker browser E2E | `docker-e2e.sh` | 1 smoke spec | — | CI job `playwright-docker` |

**Last local Vitest run:** 2026-05-30 (`npm test` in `src/frontend`).

---

## Frontend — Vitest

**Working directory:** `src/frontend`  
**Command:** `npm test`

| Test file | Role | Tests (approx.) |
|-----------|------|-----------------|
| [`App.test.tsx`](src/frontend/src/App.test.tsx) | Forms, version, errors, copy URL (FE-01–FE-06) | 6 |
| [`App.visibility.test.tsx`](src/frontend/src/App.visibility.test.tsx) | Visibility normal + polar (FE-07) | 3 |
| [`App.resilience.test.tsx`](src/frontend/src/App.resilience.test.tsx) | Parallel failures (FE-08) | 2 |
| [`App.display.test.tsx`](src/frontend/src/App.display.test.tsx) | Local/UTC labels, raw JSON (FE-09) | 2 |
| [`App.formUx.test.tsx`](src/frontend/src/App.formUx.test.tsx) | Invalid coords, loading, re-submit (FE-10) | 3 |
| [`api.test.ts`](src/frontend/src/api.test.ts) | Moon/sun/version client + edge cases | 17 |
| [`locationTime.test.ts`](src/frontend/src/locationTime.test.ts) | Time zone helpers | 6 |

**Deferred (no UI yet):** FE-11 location search, FE-12 geolocation.

---

## Backend — CTest

**Executables:** `moon_ephemeris_tests`, `moon_api_tests` (includes `DefaultTimeNoonWhenTimeOmitted`, `GetAndPostSunMatchPosition`).

**Black-box:** [`scripts/ci/moon-api-smoke.sh`](scripts/ci/moon-api-smoke.sh) (**INT-04**), [`scripts/ci/live-moon-fixture.sh`](scripts/ci/live-moon-fixture.sh) (**INT-03**).

---

## Browser E2E — Playwright

| ID | Spec | Cases |
|----|------|-------|
| E2E-01 | [`e2e/smoke.spec.ts`](src/frontend/e2e/smoke.spec.ts) | 1 |
| E2E-02 | [`e2e/errors.spec.ts`](src/frontend/e2e/errors.spec.ts) | 1 |
| E2E-03 | [`e2e/accessibility.spec.ts`](src/frontend/e2e/accessibility.spec.ts) | 2 |
| E2E-04 | [`scripts/ci/docker-e2e.sh`](scripts/ci/docker-e2e.sh) | 1 (smoke via Compose) |

Plan: [E2ETestPlan.md](E2ETestPlan.md).

---

## Manual testing

**MANUAL-01** — Full lunar-cycle visual validation: [docs/ManualTesting.md](docs/ManualTesting.md). Not run in CI.

---

## CI / CD mapping

| Workflow | What runs |
|----------|-----------|
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | Lint, Vitest, ctest, extended moon-api smoke + live fixture, Docker smoke |
| [`.github/workflows/e2e.yml`](.github/workflows/e2e.yml) | Playwright (Vite + moon-api); Docker Compose smoke (E2E-04) |

---

## How to reproduce

```bash
cd src/frontend && npm ci && npm test

cmake -S src/backend -B build && cmake --build build -j"$(nproc || sysctl -n hw.ncpu)"
ctest --test-dir build --output-on-failure

./build/moon-api 8080 &
bash scripts/ci/moon-api-smoke.sh http://127.0.0.1:8080
bash scripts/ci/live-moon-fixture.sh http://127.0.0.1:8080

cd src/frontend && npm run test:e2e:install && npm run test:e2e

docker compose build moon-tracker && bash scripts/ci/docker-e2e.sh
```

---

## Related documents

- [E2ETestPlan.md](E2ETestPlan.md)  
- [TestStrategy.md](TestStrategy.md)  
- [TestPlan.md](TestPlan.md)  
- [docs/ManualTesting.md](docs/ManualTesting.md)
