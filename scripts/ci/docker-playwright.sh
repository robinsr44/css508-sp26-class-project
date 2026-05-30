#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# docker-playwright.sh — Playwright E2E against Docker Compose (nginx + moon-api)
#
# Preconditions: `docker compose up -d moon-tracker` and moon-api-smoke already passed.
# Runs a minimal browser suite through host port 8080 (no Vite webServer).
# -----------------------------------------------------------------------------
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}/src/frontend"

export PLAYWRIGHT_SKIP_WEBSERVER=1
export PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://127.0.0.1:8080}"
export MOON_API_HEALTH_URL="${MOON_API_HEALTH_URL:-http://127.0.0.1:8080/api/health}"
export CI=true

npm run test:e2e -- e2e/smoke.spec.ts e2e/failure.spec.ts

echo "docker-playwright: OK (${PLAYWRIGHT_BASE_URL})"
