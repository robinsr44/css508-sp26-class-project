#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# live-moon-fixture.sh — live API golden check (TestPlan INT-03)
#
# Validates /api/moon for the Seattle E2E fixture against structural expectations
# so the UI and black-box smoke stay aligned with moon-api ephemeris output.
#
# Usage: live-moon-fixture.sh [base_url]
# -----------------------------------------------------------------------------
set -euo pipefail

BASE="${1:-http://127.0.0.1:8080}"
BASE="${BASE%/}"
Q="lat=47.6062&lon=-122.3321&date=2026-04-05&time=12:00"

echo "live-moon-fixture: GET ${BASE}/api/moon?${Q}"
curl -sf "${BASE}/api/moon?${Q}" -o /tmp/live-moon-fixture.json

python3 -c "
import json
with open('/tmp/live-moon-fixture.json') as f:
    j = json.load(f)
assert 'phase' in j and j['phase'].get('name'), j
assert j.get('visibility', {}).get('state') == 'normal', j
vis = j['visibility']
assert vis.get('moonrise_utc') or vis.get('moonset_utc'), vis
for k in ('instant_utc', 'location', 'illumination'):
    assert k in j, (k, list(j.keys()))
print('live-moon-fixture: OK', j['phase']['name'], 'visibility=', vis['state'])
"
