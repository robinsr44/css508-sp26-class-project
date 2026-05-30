# E2E test plan

Browser tests use **Playwright** + **Chromium** against **Vite** (`5173`) with **`moon-api` on `8080`** (same `/api` proxy as local dev), or against **Docker Compose** on host **8080**.

## Run locally

```bash
# Terminal 1 — API
cmake -S src/backend -B build && cmake --build build -j"$(nproc || sysctl -n hw.ncpu)"
./build/moon-api 8080

# Terminal 2 — Playwright (install browsers once)
cd src/frontend
npm ci
npm run test:e2e:install
npm run test:e2e
```

**Docker Compose E2E (E2E-04):**

```bash
docker compose build moon-tracker
bash scripts/ci/docker-e2e.sh
```

Health gate: [`e2e/global-setup.ts`](src/frontend/e2e/global-setup.ts) — `MOON_API_HEALTH_URL` (default `http://127.0.0.1:8080/api/health`).

## Suites

| ID | File | Purpose |
|----|------|---------|
| **E2E-01** | [`e2e/smoke.spec.ts`](src/frontend/e2e/smoke.spec.ts) | Live compute + visibility + sun labels |
| **E2E-02** | [`e2e/errors.spec.ts`](src/frontend/e2e/errors.spec.ts) | Stubbed moon **400** |
| **E2E-03** | [`e2e/accessibility.spec.ts`](src/frontend/e2e/accessibility.spec.ts) | Axe (minus `color-contrast`); keyboard Enter on Compute |
| **E2E-04** | [`scripts/ci/docker-e2e.sh`](scripts/ci/docker-e2e.sh) | Smoke spec against nginx-packaged app |

## CI

| Workflow | Jobs |
|----------|------|
| [`.github/workflows/e2e.yml`](.github/workflows/e2e.yml) | `playwright` (Vite + moon-api), `playwright-docker` (E2E-04) |
| [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | Vitest, ctest, extended `moon-api-smoke.sh`, Docker smoke |

## Manual

Visual lunar-cycle checks: [docs/ManualTesting.md](docs/ManualTesting.md) (**MANUAL-01**) — not automated in CI.
