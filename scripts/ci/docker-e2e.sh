#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# docker-e2e.sh — Playwright smoke against Docker Compose (TestPlan E2E-04 / DO-03)
#
# Preconditions: image built (docker compose build moon-tracker).
# Runs a minimal browser check via nginx on host port 8080.
# -----------------------------------------------------------------------------
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

cleanup() {
  docker compose down -v 2>/dev/null || true
}
trap cleanup EXIT

docker compose up -d moon-tracker

for _ in $(seq 1 90); do
  if curl -sf "http://127.0.0.1:8080/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

cd src/frontend
export PLAYWRIGHT_SKIP_WEBSERVER=1
export PLAYWRIGHT_BASE_URL=http://127.0.0.1:8080
export MOON_API_HEALTH_URL=http://127.0.0.1:8080/api/health

npx playwright test e2e/smoke.spec.ts --reporter=list

echo "docker-e2e: OK"
