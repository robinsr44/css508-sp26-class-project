# css508-sp26-class-project

---

## Program summary

This project is a **moon tracker** web application. You enter **GPS coordinates** (latitude and longitude), a **calendar date**, and an optional **UTC** time. The app calls a small **C++ REST API** and shows **moon phase** (name and cycle position), **illumination** (percent lit at that instant), and **visibility** for that location: **moonrise**, **moonset**, and **hours above the horizon** on the **UTC calendar day** (clear-sky geometry only—no weather).

You can run the stack **locally** (API on one port, Vite dev server with a proxy) or with **Docker Compose** (nginx serves the built UI and proxies `/api` to the API inside the container).

**Course context:** class project for **CSS 508 (Spring 2026)**. Broader design and definitions are in [PLAN.md](PLAN.md).

---

## Prerequisites

### For local development

- **CMake** 3.16 or newer  
- **C++17** toolchain (**Git** is required so CMake can fetch dependencies)  
- **Node.js** 18+ and **npm**

### For Docker

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (macOS/Windows) or **Docker Engine** + **Compose v2** (Linux)

---

## Quick start

| Goal | Command |
|------|--------|
| **Dockerized Container Deployment** | From repo root: `docker compose up --build` → open **http://localhost:8080** |
| **Develop UI + API on machine** | Terminal 1: build and run `moon-api` on **8080**. Terminal 2: `cd src/frontend && npm install && npm run dev` → open Vite’s URL (usually **http://127.0.0.1:5173**) |

## Repository layout
**Frontend** ([`src/frontend/`](src/frontend/)) — A **React** + **TypeScript** app built with **Vite**. The UI collects latitude, longitude, date, and UTC time, then calls **`/api/moon`** (via the dev-server proxy in development, or same-origin `/api` when served behind nginx in Docker). The API returns UTC instants; the UI maps the chosen coordinates to an IANA timezone with **[tz-lookup](https://www.npmjs.com/package/tz-lookup)** and formats moonrise/moonset and “instant” lines in **local** time for that location (UTC is still shown for reference). Presentation lives in [`src/frontend/src/App.tsx`](src/frontend/src/App.tsx), [`src/frontend/src/api.ts`](src/frontend/src/api.ts), and [`src/frontend/src/locationTime.ts`](src/frontend/src/locationTime.ts); styling uses component CSS. There is no client-side ephemeris: the browser only computes display timezones and displays JSON returned by the API.

**Backend** ([`src/backend/`](src/backend/)) — A **C++17** executable **`moon-api`** built with **CMake**; HTTP handling uses **cpp-httplib**, responses use **nlohmann/json**. It exposes **`GET /api/health`**, **`GET /api/moon`** (query parameters), and **`POST /api/moon`** (JSON body), validates coordinates and dates, and attaches **CORS** headers for local development. Lunar math (phase, illumination, moonrise/moonset) is implemented in [`src/backend/src/moon_ephemeris.cpp`](src/backend/src/moon_ephemeris.cpp) (adapted from [suncalc](https://github.com/mourner/suncalc)). The service is **stateless**—no database.

```
.
├── PLAN.md
├── README.md
├── Dockerfile
├── docker-compose.yml
├── docker/
│   ├── entrypoint.sh      # starts moon-api, then nginx
│   └── nginx.conf         # static site + /api → moon-api
├── src/
│   ├── backend/           # CMake project, moon-api binary
│   │   ├── CMakeLists.txt
│   │   └── src/
│   │       ├── main.cpp
│   │       ├── moon_ephemeris.h
│   │       └── moon_ephemeris.cpp
│   └── frontend/          # Vite + React
│       ├── package.json
│       ├── vite.config.ts
│       └── src/
└── build/                 # created locally by CMake (gitignored)
```

---

## Features

| Output | Meaning |
|--------|--------|
| **Phase** | Common name (e.g. Waxing Gibbous), position in the lunar cycle \([0,1)\), and Sun–Moon–Earth angle (degrees). |
| **Illumination** | Fraction and percent of the lunar disk lit at the requested instant (same everywhere on Earth for that instant). |
| **Visibility** | Moonrise and moonset as **ISO 8601 UTC** strings, optional **hours above horizon**, or `always_up` / `always_down` at extreme latitudes. |

**Not** included: weather, atmospheric extinction, or “visible only in darkness” (no sun–moon comparison).

---

## Architecture

- **Browser** → REST-style **JSON** over HTTP → **`moon-api`** (C++).
- **Stateless**: no database; each request carries coordinates and date/time and is computed on the fly.
- **Local dev**: Vite dev server (port **5173**) proxies `/api` to the API (port **8080**).
- **Docker**: **nginx** (port **80** in the container) serves the production Vite build and **reverse-proxies** `/api/` to `moon-api` on **127.0.0.1:8080** inside the same container ([docker/nginx.conf](docker/nginx.conf), [docker/entrypoint.sh](docker/entrypoint.sh)).

---

## Tech stack

| Layer | Details |
|--------|---------|
| **API** | C++17, [cpp-httplib](https://github.com/yhirose/cpp-httplib), [nlohmann/json](https://github.com/nlohmann/json) via CMake `FetchContent` |
| **Ephemeris** | Ported from [suncalc](https://github.com/mourner/suncalc) (BSD-2-Clause); low precision, UI-grade |
| **UI** | React 18, TypeScript, Vite 5 |
| **Container** | Multi-stage [Dockerfile](Dockerfile): build API → build frontend → Ubuntu + nginx + `moon-api` |

---

## Run with Docker

From the **repository root**:

```bash
cd /path/to/css508-sp26-class-project

docker compose up --build
```

- **App + API in one stack**: open **http://localhost:8080**. The UI is the built static assets; `/api/*` is proxied to the C++ server inside the container.
- **Health check**: `curl -s http://localhost:8080/api/health`
- **Detached**: `docker compose up -d --build` — stop with `docker compose down`
- **Port mapping**: host **8080** → container **80** ([docker-compose.yml](docker-compose.yml)). To use another host port, change the left side of `ports` (for example `"3000:80"`).

The image builds the C++ binary, runs `npm run build` under `src/frontend`, then copies `dist/` into nginx. No separate database or env files are required.

---

## Run on macOS (without Docker)

### One-time tooling

**Xcode command-line tools** (compiler, SDKs):

```bash
xcode-select --install
```

Optional — **Homebrew** installs for CMake and Node:

```bash
brew install cmake node
```

Verify:

```bash
cmake --version
node --version
npm --version
```

### Backend (C++ API)

From the **repository root**:

```bash
cd /path/to/css508-sp26-class-project

cmake -S src/backend -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build

./build/moon-api 8080
```

- **Port**: first argument is the listen port; default is **8080** if omitted (`./build/moon-api`).
- You should see: `moon-api listening on http://0.0.0.0:8080` (or your chosen port).
- **Health**: `curl -s http://127.0.0.1:8080/api/health`

### Frontend (Vite dev server)

Use a **second** terminal; the API from the previous step must stay running.

```bash
cd /path/to/css508-sp26-class-project/src/frontend

npm install
npm run dev
```

Open the URL Vite prints (typically **http://127.0.0.1:5173**). [vite.config.ts](src/frontend/vite.config.ts) proxies **`/api`** to **http://127.0.0.1:8080**, so the browser can call `/api/moon` without CORS issues during development.

### Production-style frontend build (optional)

```bash
cd /path/to/css508-sp26-class-project/src/frontend
npm run build
```

Output: **`src/frontend/dist/`**. Serving that folder is optional for local work (Docker and nginx already do this in the container image).

---

## HTTP API reference

Base path: **`/api`**. Responses are **JSON** with `Content-Type: application/json`. Errors use **400** / **500** with a body like `{"error":"..."}`.

**CORS** (for browsers): `Access-Control-Allow-Origin: *`, methods `GET`, `POST`, `OPTIONS`, header `Content-Type` allowed. `OPTIONS` is defined for `/api/moon`, `/api/sun`, `/api/health`, and `/api/version`.

### `GET /api/health`

Returns service status.

**Example**

```bash
curl -s http://127.0.0.1:8080/api/health
```

**Example response**

```json
{"status":"ok"}
```

### `GET /api/version`

Returns build metadata for the running server.

**Example**

```bash
curl -s http://127.0.0.1:8080/api/version
```

**Example response**

```json
{"service":"moon-api","version":"1.1.0"}
```

### `GET /api/moon`

**Query parameters**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `lat` | Yes | Latitude in decimal degrees, **[-90, 90]** |
| `lon` | Yes | Longitude in decimal degrees, **[-180, 180]** |
| `date` | Yes | Calendar date **`YYYY-MM-DD`** |
| `time` | No | Time **`HH:MM`** in **UTC** (default **`12:00`**) |

**Example**

```bash
curl -s "http://127.0.0.1:8080/api/moon?lat=47.6062&lon=-122.3321&date=2026-04-05&time=12:00"
```

### `POST /api/moon`

**Body** (JSON): `Content-Type: application/json`

| Field | Required | Description |
|-------|----------|-------------|
| `lat` | Yes | number |
| `lon` | Yes | number |
| `date` | Yes | string `YYYY-MM-DD` |
| `time` | No | string `HH:MM` UTC (default **12:00**) |

**Example**

```bash
curl -s -X POST http://127.0.0.1:8080/api/moon \
  -H "Content-Type: application/json" \
  -d '{"lat":47.6062,"lon":-122.3321,"date":"2026-04-05","time":"12:00"}'
```

### Successful `GET/POST /api/moon` response shape

```json
{
  "instant_utc": "2026-04-05T12:00:00Z",
  "location": { "latitude": 47.6062, "longitude": -122.3321 },
  "phase": {
    "name": "Waxing Gibbous",
    "cycle_fraction": 0.72,
    "sun_moon_earth_angle_deg": 95.5
  },
  "illumination": {
    "fraction": 0.98,
    "percent": 98.0
  },
  "visibility": {
    "state": "normal",
    "moonrise_utc": "2026-04-05T...Z",
    "moonset_utc": "2026-04-06T...Z",
    "hours_above_horizon": 12.34
  }
}
```

`visibility.state` is **`normal`**, **`always_up`**, or **`always_down`**. For `normal`, moonrise/moonset may be omitted in edge cases; `hours_above_horizon` appears when both rise and set are present.

### `GET /api/sun`

**Query parameters** — same as `GET /api/moon` (`lat`, `lon`, `date`, optional `time` UTC default `12:00`).

Returns the **sun’s apparent azimuth and altitude** at the requested UTC instant (low-precision suncalc-style model). This does **not** include sunrise/sunset times.

**Example**

```bash
curl -s "http://127.0.0.1:8080/api/sun?lat=47.6062&lon=-122.3321&date=2026-04-05&time=12:00"
```

### `POST /api/sun`

**Body** (JSON): same fields as `POST /api/moon`.

**Example**

```bash
curl -s -X POST http://127.0.0.1:8080/api/sun \
  -H "Content-Type: application/json" \
  -d '{"lat":47.6062,"lon":-122.3321,"date":"2026-04-05","time":"12:00"}'
```

### Successful `GET/POST /api/sun` response shape

```json
{
  "instant_utc": "2026-04-05T12:00:00Z",
  "location": { "latitude": 47.6062, "longitude": -122.3321 },
  "position": {
    "azimuth_deg": -119.54,
    "altitude_deg": -16.31
  }
}
```

---

## Time and semantics (important)

- **`instant_utc`**, **`time`** query/body field, and phase/illumination use the **UTC** clock.
- **Moonrise / moonset** are computed for the **UTC calendar day** of `date` (midnight UTC to midnight UTC). They do not follow your local civil timezone unless you convert externally.
- **Illumination** at an instant does not depend on location; **rise/set** do.
- **Visibility** means geometric horizon crossing under a clear-sky model, not weather.

---

## Troubleshooting

| Issue | What to try |
|-------|----------------|
| `cmake: command not found` / `node: command not found` | Install CMake and Node (e.g. `brew install cmake node`) or use nvm/fnm for Node. |
| Port **8080** already in use | Use another port: `./build/moon-api 9090` and point Vite’s proxy at `9090`, or change Docker `ports` / nginx upstream in a fork. |
| Docker build fails on network | Ensure Docker can reach the internet (base images, `npm install`, CMake `FetchContent`). |
| Browser can’t reach API in dev | Start **`moon-api` first**; confirm Vite proxy target matches your API port. |
| Empty or wrong rise/set | Extreme latitudes may yield `always_up` / `always_down`; UTC-day semantics may differ from local almanacs. |

---

## Attribution

Ephemeris logic in `src/backend/src/moon_ephemeris.cpp` is derived from **[suncalc](https://github.com/mourner/suncalc)** (BSD-2-Clause). It is intended for **education and UI**, not navigation or mission planning.

---

## License / course

This repository is a **course project** for **CSS 508** (Spring 2026). Third-party libraries are subject to their respective licenses (see upstream projects).
