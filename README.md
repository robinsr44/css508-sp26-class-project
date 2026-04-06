# css508-sp26-class-project

Class project for the CSS 508 Spring 2026 semester: a **moon tracker** web app with a **C++** JSON API and a **React** (Vite + TypeScript) frontend.

Design and scope are documented in [PLAN.md](PLAN.md).

## Prerequisites

- **CMake** 3.16+, **C++17** compiler, **Git** (for CMake `FetchContent` dependencies)
- **Node.js** 18+ and **npm** (for the frontend)

## Backend (C++ API)

From the repository root:

```bash
cmake -S backend -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build
./build/moon-api 8080
```

The server listens on `http://127.0.0.1:8080` (port optional, default `8080`).

- `GET /api/health` — health check
- `GET /api/moon?lat=LAT&lon=LON&date=YYYY-MM-DD&time=HH:MM` — `time` is **UTC** (optional; default `12:00`)
- `POST /api/moon` — JSON body: `{ "lat": number, "lon": number, "date": "YYYY-MM-DD", "time": "HH:MM" }` (`time` optional)

## Frontend (React)

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the printed URL (usually `http://127.0.0.1:5173`). The Vite dev server **proxies** `/api` to `http://127.0.0.1:8080`, so start the backend first.

`npm run build` writes static files to `frontend/dist/`. You can configure the C++ server to serve that directory in a later iteration, or deploy the API and static site separately.

## Notes

- Ephemeris math is adapted from [suncalc](https://github.com/mourner/suncalc) (BSD-2-Clause); suitable for UI, not navigation-grade precision.
- Moonrise/set are computed for the **UTC calendar day** of the selected date. Phase and illumination use the chosen **UTC** time instant.
