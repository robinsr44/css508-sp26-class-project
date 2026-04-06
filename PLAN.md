# Moon tracker — project plan

## Goals

- Show **moon phase**, **illumination**, and **visibility** (moonrise / moonset) for user-supplied **GPS coordinates** and **date**.
- **C++** backend with a **REST-style JSON API**; **React** (Vite + TypeScript) frontend.
- **No database** for the MVP: each request is computed statelessly.

## Definitions

| Concept | Meaning |
|--------|---------|
| Phase | Named phase (e.g. New, Full) plus numeric phase in \([0,1)\) cycle. |
| Illumination | Percent of lunar disk illuminated (same for all locations at a given instant). |
| Visibility | Moonrise and moonset for the observer; geometric only (clear sky assumed). |

## Architecture

- Browser → `GET /api/moon` (or `POST /api/moon` with JSON body) → C++ HTTP server → ephemeris module → JSON response.
- Development: frontend on Vite (e.g. port 5173), API on another port; API sends **CORS** headers for the dev origin.

## Repository layout

```
PLAN.md
README.md
backend/CMakeLists.txt
backend/src/main.cpp
backend/src/moon_ephemeris.h
backend/src/moon_ephemeris.cpp
frontend/          # Vite + React + TypeScript
```

## API (sketch)

**Query:** `lat`, `lon`, `date` (YYYY-MM-DD), optional `time` (HH:MM, UTC, default 12:00).

**Response fields:** `phase` (name, fraction), `illumination` (percent), `visibility` (moonrise/moonset ISO timestamps UTC, hours above horizon when both exist).

## Astronomy approach

Low-precision Sun/Moon models suitable for UI (based on widely used public formulas; see source comments in `moon_ephemeris.cpp`). Not intended for mission-critical navigation.

## Build and run

See [README.md](README.md).

## Future enhancements

Map picker, twilight-aware “visible at night,” user accounts / saved locations (would introduce a database).
