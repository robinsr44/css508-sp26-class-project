#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# specialized-bundle-budget.sh — production frontend bundle size budget
#
# Preconditions: `npm run build` has produced src/frontend/dist/assets/.
#
# Env overrides:
#   BUNDLE_MAX_JS_CSS_KB=400   — max combined JS+CSS size (KiB, uncompressed)
#   BUNDLE_MAX_GZIP_KB=120     — max combined gzip size from Vite build output
#
# Usage (from repo root):
#   cd src/frontend && npm run build && bash ../../scripts/ci/specialized-bundle-budget.sh
# -----------------------------------------------------------------------------
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST_ASSETS="${REPO_ROOT}/src/frontend/dist/assets"

BUNDLE_MAX_JS_CSS_KB="${BUNDLE_MAX_JS_CSS_KB:-400}"
BUNDLE_MAX_GZIP_KB="${BUNDLE_MAX_GZIP_KB:-120}"

if [[ ! -d "${DIST_ASSETS}" ]]; then
  echo "specialized-bundle-budget: missing ${DIST_ASSETS} — run npm run build first" >&2
  exit 1
fi

python3 << PY
from pathlib import Path
import gzip

dist = Path("${DIST_ASSETS}")
js_css = [p for p in dist.iterdir() if p.suffix in (".js", ".css")]
if not js_css:
    raise SystemExit(f"specialized-bundle-budget: no JS/CSS assets in {dist}")

raw_bytes = sum(p.stat().st_size for p in js_css)
raw_kib = raw_bytes / 1024.0
max_raw_kib = float("${BUNDLE_MAX_JS_CSS_KB}")

print(
    f"specialized-bundle-budget: js+css={raw_kib:.1f} KiB "
    f"(limit {max_raw_kib:.0f} KiB)"
)
if raw_kib > max_raw_kib:
    raise SystemExit("specialized-bundle-budget: uncompressed JS+CSS exceeded budget")

# Parse gzip sizes from last vite build log is fragile; estimate from .gz if present,
# otherwise use a conservative ratio check via brotli/gzip files when vite emits them.
# Vite prints gzip in build output; we re-read files and gzip compress for budget.
import gzip

gzip_bytes = 0
for path in js_css:
    data = path.read_bytes()
    gzip_bytes += len(gzip.compress(data, compresslevel=9))

gzip_kib = gzip_bytes / 1024.0
max_gzip_kib = float("${BUNDLE_MAX_GZIP_KB}")
print(
    f"specialized-bundle-budget: js+css gzip≈{gzip_kib:.1f} KiB "
    f"(limit {max_gzip_kib:.0f} KiB)"
)
if gzip_kib > max_gzip_kib:
    raise SystemExit("specialized-bundle-budget: gzip JS+CSS exceeded budget")

print("specialized-bundle-budget: OK")
PY
