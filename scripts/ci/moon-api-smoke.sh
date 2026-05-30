#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# moon-api-smoke.sh — black-box HTTP integration smoke
#
# Purpose
#   Exercises a running HTTP server (the real moon-api binary or nginx proxying
#   to it) over TCP. This complements moon_api_tests (in-process httplib): it
#   proves listen/bind, the shipped executable, and/or the reverse proxy path.
#
# Tests performed (each fails the script on mismatch)
#   1. Reachability — Poll GET /api/health until OK or timeout (stack startup).
#   2. Health contract — 200 JSON with status "ok" (maps TestPlan HTTP-01).
#   3. Version contract — service "moon-api" and non-empty version (HTTP-02).
#   4. Moon happy path — GET /api/moon with valid query; body includes
#      instant_utc, location (lat/lon), phase (name), illumination, visibility
#      state (HTTP-03 shape; aligns with ProjectSelection integration checklist).
#   5. Moon validation path — GET /api/moon missing required date → 400 and
#      JSON { "error": string } (HTTP-06 class behavior).
#   6. Sun GET happy path — GET /api/sun valid query; position fields present.
#   7. Moon POST happy path — POST /api/moon JSON body → 200 with phase block.
#   8. Sun POST happy path — POST /api/sun JSON body → 200 with position block.
#   9. Default UTC time — GET without `time` matches explicit time=12:00 instant.
#  10. GET/POST sun parity — azimuth and altitude match within tolerance.
#
# Usage: moon-api-smoke.sh [base_url]
# Example: moon-api-smoke.sh http://127.0.0.1:8080
# -----------------------------------------------------------------------------
set -euo pipefail

BASE="${1:-http://127.0.0.1:8080}"
BASE="${BASE%/}"

MOON_Q="lat=47.6062&lon=-122.3321&date=2026-04-05&time=12:00"
MOON_Q_NO_TIME="lat=47.6062&lon=-122.3321&date=2026-04-05"
MOON_POST_BODY='{"lat":47.6062,"lon":-122.3321,"date":"2026-04-05","time":"12:00"}'
SUN_POST_BODY='{"lat":47.6062,"lon":-122.3321,"date":"2026-04-05","time":"12:00"}'

# --- Test 1: wait for server (CI/Docker startup) ---
echo "moon-api-smoke: waiting for ${BASE}/api/health ..."
for _ in $(seq 1 90); do
  if curl -sf "${BASE}/api/health" -o /tmp/smoke-health.json 2>/dev/null; then
    break
  fi
  sleep 1
done
if [[ ! -s /tmp/smoke-health.json ]]; then
  echo "moon-api-smoke: timeout waiting for health" >&2
  exit 1
fi

# --- Test 2: health JSON ---
python3 -c "
import json
with open('/tmp/smoke-health.json') as f:
    j = json.load(f)
assert j.get('status') == 'ok', j
"

# --- Test 3: version JSON ---
curl -sf "${BASE}/api/version" -o /tmp/smoke-version.json
python3 -c "
import json
with open('/tmp/smoke-version.json') as f:
    j = json.load(f)
assert j.get('service') == 'moon-api', j
assert j.get('version'), j
"

# --- Test 4: moon GET success shape ---
curl -sf "${BASE}/api/moon?${MOON_Q}" -o /tmp/smoke-moon.json
python3 -c "
import json
with open('/tmp/smoke-moon.json') as f:
    j = json.load(f)
for k in ('instant_utc', 'location', 'phase', 'illumination', 'visibility'):
    assert k in j, (k, list(j.keys()))
loc = j['location']
assert 'latitude' in loc and 'longitude' in loc
assert 'name' in j['phase']
assert 'state' in j['visibility']
"

# --- Test 5: moon GET validation error ---
code=$(curl -s -o /tmp/smoke-moon-400.json -w "%{http_code}" "${BASE}/api/moon?lat=1&lon=1")
if [[ "${code}" != "400" ]]; then
  echo "moon-api-smoke: expected 400 for missing date, got ${code}" >&2
  cat /tmp/smoke-moon-400.json >&2 || true
  exit 1
fi
python3 -c "
import json
with open('/tmp/smoke-moon-400.json') as f:
    j = json.load(f)
assert 'error' in j and isinstance(j['error'], str)
"

# --- Test 6: sun GET success shape ---
curl -sf "${BASE}/api/sun?${MOON_Q}" -o /tmp/smoke-sun.json
python3 -c "
import json
with open('/tmp/smoke-sun.json') as f:
    j = json.load(f)
assert 'instant_utc' in j and 'position' in j
pos = j['position']
assert 'azimuth_deg' in pos and 'altitude_deg' in pos
"

# --- Test 7: moon POST success shape ---
code=$(curl -s -o /tmp/smoke-moon-post.json -w "%{http_code}" \
  -X POST "${BASE}/api/moon" \
  -H "Content-Type: application/json" \
  -d "${MOON_POST_BODY}")
if [[ "${code}" != "200" ]]; then
  echo "moon-api-smoke: expected 200 for POST moon, got ${code}" >&2
  cat /tmp/smoke-moon-post.json >&2 || true
  exit 1
fi
python3 -c "
import json
with open('/tmp/smoke-moon-post.json') as f:
    j = json.load(f)
assert 'phase' in j and 'illumination' in j
"

# --- Test 8: sun POST success shape ---
code=$(curl -s -o /tmp/smoke-sun-post.json -w "%{http_code}" \
  -X POST "${BASE}/api/sun" \
  -H "Content-Type: application/json" \
  -d "${SUN_POST_BODY}")
if [[ "${code}" != "200" ]]; then
  echo "moon-api-smoke: expected 200 for POST sun, got ${code}" >&2
  cat /tmp/smoke-sun-post.json >&2 || true
  exit 1
fi
python3 -c "
import json
with open('/tmp/smoke-sun-post.json') as f:
    j = json.load(f)
assert 'position' in j
"

# --- Test 9: omitted time defaults to 12:00 UTC ---
curl -sf "${BASE}/api/moon?${MOON_Q_NO_TIME}" -o /tmp/smoke-moon-default-time.json
python3 -c "
import json
with open('/tmp/smoke-moon.json') as f:
    j_explicit = json.load(f)
with open('/tmp/smoke-moon-default-time.json') as f:
    j_default = json.load(f)
assert j_default['instant_utc'] == j_explicit['instant_utc'], (j_default, j_explicit)
"

# --- Test 10: GET/POST sun parity ---
python3 -c "
import json
with open('/tmp/smoke-sun.json') as f:
    jg = json.load(f)
with open('/tmp/smoke-sun-post.json') as f:
    jp = json.load(f)
eps = 1e-4
for k in ('azimuth_deg', 'altitude_deg'):
    assert abs(jg['position'][k] - jp['position'][k]) < eps, (k, jg['position'][k], jp['position'][k])
assert jg['instant_utc'] == jp['instant_utc']
"

echo "moon-api-smoke: OK (${BASE})"
