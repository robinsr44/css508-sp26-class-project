#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# docker-smoke.sh — Docker / nginx integration smoke (TestPlan 4.3.1)
#
# Purpose
#   Verifies the production Compose stack: nginx serves the built SPA and
#   reverse-proxies /api/ to moon-api inside the container. This is not covered
#   by unit tests or by hitting moon-api alone on a dev port.
#
# Preconditions
#   Image already built (e.g. docker compose build moon-tracker).
#
# Tests performed
#   DO-02 (via moon-api-smoke.sh on host port 8080)
#     Same five checks as scripts/ci/moon-api-smoke.sh, but through the mapped
#     host port so requests hit nginx → moon-api (proves location /api/ proxy).
#   DO-01
#     GET / on the same host:port returns HTML (SPA shell from static root +
#     try_files), proving the packaged UI is served, not only the API.
#
# Usage: from repository root — bash scripts/ci/docker-smoke.sh
# -----------------------------------------------------------------------------
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

cleanup() {
  docker compose down -v 2>/dev/null || true
}
trap cleanup EXIT

docker compose up -d moon-tracker

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# DO-02: health, version, moon success, moon 400 — all via nginx on 8080:80
bash "${SCRIPT_DIR}/moon-api-smoke.sh" "http://127.0.0.1:8080"

# DO-01: root serves the SPA shell (nginx static + try_files).
if ! curl -sf "http://127.0.0.1:8080/" | grep -qE '<!DOCTYPE|<html'; then
  echo "docker-smoke: DO-01 failed — root did not return HTML" >&2
  exit 1
fi

echo "docker-smoke: OK (DO-01 UI, DO-02 /api/moon via nginx)"
