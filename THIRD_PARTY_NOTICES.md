# Third-party notices

This project incorporates open-source software and external data services. The
notices below apply to redistributions of this repository or its built artifacts
(including the `moon-api` binary, Vite production bundle, and Docker image).

**Runtime components** are linked or bundled into what end users run. **Development
and test** tools are used only during build and CI. **External services** are
called over the network at runtime but are not vendored in the repository.

Full license texts for MIT and similar permissive licenses are available at each
project’s upstream repository (linked below). Where a specific notice is required
in source or binary form, it is reproduced in this file.

---

## Runtime components (shipped)

| Component | Version | License | Role in this project |
|-----------|---------|---------|----------------------|
| [SunCalc](https://github.com/mourner/suncalc) (adapted) | — | BSD-2-Clause | Moon/sun ephemeris in `moon_ephemeris.cpp` |
| [cpp-httplib](https://github.com/yhirose/cpp-httplib) | 0.18.3 | MIT | HTTP server for `moon-api` |
| [nlohmann/json](https://github.com/nlohmann/json) | 3.11.3 | MIT | JSON request/response parsing in `moon-api` |
| [React](https://github.com/facebook/react) | 18.3.1 | MIT | UI framework |
| [react-dom](https://github.com/facebook/react) | 18.3.1 | MIT | DOM rendering |
| [tz-lookup](https://github.com/darkskyapp/tz-lookup) | 6.1.25 | CC0-1.0 | IANA timezone lookup from coordinates |
| [nginx](https://nginx.org/) | (Ubuntu 22.04 package) | BSD-2-Clause | Static file server and `/api` reverse proxy (Docker) |

### tz-lookup data

`tz-lookup` embeds compressed timezone boundary data sourced from
[timezone-boundary-builder](https://github.com/evansiroky/timezone-boundary-builder)
(ODbL). Lookups are approximate near borders; the UI falls back to UTC when lookup
fails.

---

## External services (not vendored)

| Service | Policy / license | Role in this project |
|---------|------------------|----------------------|
| [Nominatim](https://nominatim.org/) / [OpenStreetMap](https://www.openstreetmap.org/) | [Usage policy](https://operations.osmfoundation.org/policies/nominatim/); map data © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright) | Optional place-name search in the browser (`nominatim.ts`) |

The UI displays OpenStreetMap attribution when location search is offered. Requests
use a custom `User-Agent`, client-side caching, and a 1 request/second rate limit.

---

## Development and test only (not shipped)

These are listed for completeness; they are **not** included in the production
Docker image or end-user bundle.

| Component | Version | License | Role |
|-----------|---------|---------|------|
| [Google Test](https://github.com/google/googletest) | 1.14.0 | BSD-3-Clause | C++ unit tests |
| [Vite](https://github.com/vitejs/vite) | 5.4.x | MIT | Frontend dev server and production build |
| [TypeScript](https://github.com/microsoft/TypeScript) | 5.6.x | Apache-2.0 | Type checking |
| [Vitest](https://github.com/vitest-dev/vitest) | 2.1.x | MIT | Frontend unit tests |
| [Playwright](https://github.com/microsoft/playwright) | 1.60.x | Apache-2.0 | Browser E2E tests |
| [@axe-core/playwright](https://github.com/dequelabs/axe-core-npm) | 4.11.x | MPL-2.0 | Accessibility scans in E2E |
| [Testing Library](https://github.com/testing-library) | various | MIT | Component tests |
| [ESLint](https://github.com/eslint/eslint) | 9.15.x | MIT | Linting |

Other npm devDependencies (types, plugins, jsdom, etc.) are MIT or Apache-2.0 unless
noted in `src/frontend/package-lock.json`.

---

## SunCalc (full BSD-2-Clause notice)

Moon and sun ephemeris routines in `src/backend/src/moon_ephemeris.cpp` are
adapted from [SunCalc](https://github.com/mourner/suncalc) by Vladimir
Agafonkin. The frontend test mirror in
`src/frontend/src/test/ephemerisMirror.ts` follows the same algorithms for
consistency in tests.

Copyright (c) 2011-2015, Vladimir Agafonkin  
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

**Project use:** Adapted for low-precision, UI-grade moon phase, illumination,
moonrise/moonset, and sun position calculations. Not intended for navigation,
aviation, maritime, or mission-critical use.
