#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# specialized-performance.sh — API performance checks (specialized testing)
#
# Preconditions: moon-api listening at BASE (default http://127.0.0.1:8080).
#
# Tests (thresholds overridable via env — see below):
#   1. Single-request latency — sequential GET /api/moon; median and p95 bounds.
#   2. Parallel moon + sun — wall-clock time for concurrent moon and sun requests.
#   3. Light concurrency — 100 parallel GET /api/moon; all HTTP 200; p95 bound.
#
# Usage: specialized-performance.sh [base_url]
# Example: specialized-performance.sh http://127.0.0.1:8080
#
# Env overrides (milliseconds unless noted):
#   PERF_MOON_SAMPLES=50
#   PERF_MOON_MEDIAN_MS=50
#   PERF_MOON_P95_MS=200
#   PERF_PARALLEL_MS=500
#   PERF_CONCURRENT_REQUESTS=100
#   PERF_CONCURRENT_WORKERS=20
#   PERF_CONCURRENT_P95_MS=500
# -----------------------------------------------------------------------------
set -euo pipefail

BASE="${1:-http://127.0.0.1:8080}"
BASE="${BASE%/}"

export PERF_MOON_SAMPLES="${PERF_MOON_SAMPLES:-50}"
export PERF_MOON_MEDIAN_MS="${PERF_MOON_MEDIAN_MS:-50}"
export PERF_MOON_P95_MS="${PERF_MOON_P95_MS:-200}"
export PERF_PARALLEL_MS="${PERF_PARALLEL_MS:-500}"
export PERF_CONCURRENT_REQUESTS="${PERF_CONCURRENT_REQUESTS:-100}"
export PERF_CONCURRENT_WORKERS="${PERF_CONCURRENT_WORKERS:-20}"
export PERF_CONCURRENT_P95_MS="${PERF_CONCURRENT_P95_MS:-500}"
export PERF_BASE_URL="${BASE}"

python3 << 'PY'
import concurrent.futures
import os
import statistics
import sys
import threading
import time
import urllib.error
import urllib.request

BASE = os.environ["PERF_BASE_URL"]
MOON = (
    f"{BASE}/api/moon?"
    "lat=47.6062&lon=-122.3321&date=2026-04-05&time=12:00"
)
SUN = (
    f"{BASE}/api/sun?"
    "lat=47.6062&lon=-122.3321&date=2026-04-05&time=12:00"
)

SAMPLES = int(os.environ["PERF_MOON_SAMPLES"])
MEDIAN_MAX = float(os.environ["PERF_MOON_MEDIAN_MS"])
P95_MAX = float(os.environ["PERF_MOON_P95_MS"])
PARALLEL_MAX = float(os.environ["PERF_PARALLEL_MS"])
CONCURRENT_N = int(os.environ["PERF_CONCURRENT_REQUESTS"])
CONCURRENT_WORKERS = int(os.environ["PERF_CONCURRENT_WORKERS"])
CONCURRENT_P95_MAX = float(os.environ["PERF_CONCURRENT_P95_MS"])


def fetch_ms(url: str) -> float:
    start = time.perf_counter()
    with urllib.request.urlopen(url, timeout=10) as response:
        if response.status != 200:
            raise RuntimeError(f"{url} returned HTTP {response.status}")
        response.read()
    return (time.perf_counter() - start) * 1000.0


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, int(round((pct / 100.0) * (len(ordered) - 1)))))
    return ordered[index]


print(f"specialized-performance: base={BASE}")

# --- Test 1: sequential moon latency ---
try:
    moon_times = [fetch_ms(MOON) for _ in range(SAMPLES)]
except urllib.error.URLError as err:
    print(f"specialized-performance: moon latency failed: {err}", file=sys.stderr)
    sys.exit(1)

moon_median = statistics.median(moon_times)
moon_p95 = percentile(moon_times, 95)
print(
    f"  moon latency: samples={SAMPLES} "
    f"median={moon_median:.2f}ms p95={moon_p95:.2f}ms "
    f"(limits median<={MEDIAN_MAX}ms p95<={P95_MAX}ms)"
)
if moon_median > MEDIAN_MAX or moon_p95 > P95_MAX:
    print("specialized-performance: moon latency exceeded budget", file=sys.stderr)
    sys.exit(1)

# --- Test 2: parallel moon + sun ---
results: list[float | None] = [None, None]
errors: list[str] = []


def run_labeled(label: str, url: str, slot: int) -> None:
    try:
        results[slot] = fetch_ms(url)
    except Exception as exc:  # noqa: BLE001 — collect for assertion message
        errors.append(f"{label}: {exc}")


parallel_start = time.perf_counter()
t_moon = threading.Thread(target=run_labeled, args=("moon", MOON, 0))
t_sun = threading.Thread(target=run_labeled, args=("sun", SUN, 1))
t_moon.start()
t_sun.start()
t_moon.join()
t_sun.join()
parallel_wall = (time.perf_counter() - parallel_start) * 1000.0

if errors:
    print(f"specialized-performance: parallel requests failed: {'; '.join(errors)}", file=sys.stderr)
    sys.exit(1)

print(
    f"  parallel moon+sun: wall={parallel_wall:.2f}ms "
    f"moon={results[0]:.2f}ms sun={results[1]:.2f}ms "
    f"(limit wall<={PARALLEL_MAX}ms)"
)
if parallel_wall > PARALLEL_MAX:
    print("specialized-performance: parallel wall time exceeded budget", file=sys.stderr)
    sys.exit(1)

# --- Test 3: concurrent load ---
def one_moon(_: int) -> float:
    return fetch_ms(MOON)


with concurrent.futures.ThreadPoolExecutor(max_workers=CONCURRENT_WORKERS) as pool:
    load_start = time.perf_counter()
    try:
        concurrent_times = list(pool.map(one_moon, range(CONCURRENT_N)))
    except Exception as exc:  # noqa: BLE001
        print(f"specialized-performance: concurrent load failed: {exc}", file=sys.stderr)
        sys.exit(1)
    load_wall = (time.perf_counter() - load_start) * 1000.0

load_p95 = percentile(concurrent_times, 95)
print(
    f"  concurrent load: requests={CONCURRENT_N} workers={CONCURRENT_WORKERS} "
    f"wall={load_wall:.2f}ms p95={load_p95:.2f}ms "
    f"(limit p95<={CONCURRENT_P95_MAX}ms)"
)
if load_p95 > CONCURRENT_P95_MAX:
    print("specialized-performance: concurrent p95 exceeded budget", file=sys.stderr)
    sys.exit(1)

print(f"specialized-performance: OK ({BASE})")
PY
