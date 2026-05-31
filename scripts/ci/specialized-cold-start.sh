#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# specialized-cold-start.sh — moon-api startup time until /api/health is OK
#
# Usage: specialized-cold-start.sh <moon-api-binary> [port]
#
# Env:
#   COLD_START_MAX_MS=5000
# -----------------------------------------------------------------------------
set -euo pipefail

BIN="${1:?usage: specialized-cold-start.sh <moon-api-binary> [port]}"
PORT="${2:-8080}"
COLD_START_MAX_MS="${COLD_START_MAX_MS:-5000}"

if [[ ! -x "${BIN}" ]]; then
  echo "specialized-cold-start: not executable: ${BIN}" >&2
  exit 1
fi

# Ensure port is free for a clean measurement.
if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
  echo "specialized-cold-start: port ${PORT} already serving health — skip or use another port" >&2
  exit 1
fi

start_ms=$(python3 -c "import time; print(int(time.time()*1000))")
"${BIN}" "${PORT}" &
pid=$!

cleanup() {
  kill "${pid}" 2>/dev/null || true
  wait "${pid}" 2>/dev/null || true
}
trap cleanup EXIT

for _ in $(seq 1 120); do
  if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
    end_ms=$(python3 -c "import time; print(int(time.time()*1000))")
    elapsed=$((end_ms - start_ms))
    echo "specialized-cold-start: health OK in ${elapsed}ms (limit ${COLD_START_MAX_MS}ms)"
    if [[ "${elapsed}" -gt "${COLD_START_MAX_MS}" ]]; then
      echo "specialized-cold-start: exceeded budget" >&2
      exit 1
    fi
    exit 0
  fi
  sleep 0.05
done

echo "specialized-cold-start: timed out waiting for /api/health on port ${PORT}" >&2
exit 1
