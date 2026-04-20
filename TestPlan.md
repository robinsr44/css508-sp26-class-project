# Test plan

This document is the **test plan** for the **moon tracker** class project: a React + TypeScript client and a C++ `moon-api` service. It turns the goals in [TestStrategy.md](TestStrategy.md) into **planned activities**, **environments**, and **checklists**. Functional definitions and API contracts are authoritative in [README.md](README.md) and [Design.md](Design.md).

---

## 1. Document control

| Item | Value |
|------|--------|
| **Purpose** | Plan what to test, how, and when; record pass/fail criteria for releases and coursework milestones. |
| **Related documents** | [TestStrategy.md](TestStrategy.md), [Design.md](Design.md), [README.md](README.md) |
| **Revision** | Update when routes, JSON shapes, or deployment paths change. |

---

## 2. Items under test

| ID | Feature / component | Source of truth |
|----|---------------------|-----------------|
| **T1** | Lunar ephemeris: phase, illumination, moonrise/moonset (UTC day), polar states | `moon_ephemeris`, README “Time and semantics” |
| **T2** | Solar ephemeris: azimuth and altitude at instant | `moon_ephemeris`, README `/api/sun` |
| **T3** | Input parsing and validation: lat/lon bounds, `YYYY-MM-DD`, `HH:MM` UTC | `main.cpp`, README query/body tables |
| **T4** | HTTP API: `GET`/`POST` `/api/moon`, `/api/sun`; `GET` `/api/health`, `/api/version`; errors 400/500 | README API reference |
| **T5** | CORS and `OPTIONS` for documented `/api/*` routes | README, Design |
| **T6** | Frontend: observation form, parallel moon+sun fetch, errors, timezone display, copy/URL helpers | Design “Client” |
| **T7** | Container: nginx static + `/api` proxy, process startup | `Dockerfile`, `docker/`, README Docker |

---

## 3. Test environments

| Environment | Purpose | Notes |
|-------------|---------|--------|
| **Local dev** | Developer iteration | `moon-api` on chosen port; Vite dev server with `/api` proxy (README). |
| **API-only** | Contract and ephemeris checks | `curl` / scripts against `http://127.0.0.1:<port>`; no UI. |
| **Docker Compose** | Production-like smoke | Host port mapped to container (README); `/api` same origin as UI. |
| **CI (recommended)** | Repeatable gates | Build C++ + frontend; run unit/API tests; optional Docker smoke. |

**Test data:** Use fixed fixtures (see [TestStrategy.md](TestStrategy.md) § Test data). Record **tolerance** for floating-point comparisons in test code or comments.

---

## 4. Test types and coverage targets

| Type | Focus | Target coverage (plan) |
|------|--------|-------------------------|
| **Unit — C++** | `moon_ephemeris`, date/time parsing helpers | All public computation entry points; parsing happy and sad paths. |
| **Unit — TS** | `locationTime.ts`, `api.ts` (and similar pure modules) | Branches for success, HTTP errors, timezone fallback. |
| **API / contract** | Status codes, JSON shape, GET vs POST parity | Every route and method in README; representative validation failures. |
| **E2E (optional)** | One happy-path UI submit | One browser flow per milestone or release. |
| **Smoke** | Build + health + sample moon | Every CI run or before demo. |

---

## 5. Planned test cases (matrix)

Priorities: **P0** = must pass for any merge/demo; **P1** = should pass before milestone complete; **P2** = nice to have.

### 5.1 Backend — ephemeris and parsing (automated when tests exist)

| Case ID | Priority | Description | Expected result |
|---------|----------|-------------|-----------------|
| BE-01 | P0 | `compute_full` for mid-latitude fixture (normal visibility) | Phase name and illumination within tolerance; `visibility.state` is `normal` when rise/set expected for fixture. |
| BE-02 | P1 | High-latitude fixture where README allows `always_up` / `always_down` | Correct `visibility.state`; no crash. |
| BE-03 | P1 | Leap day / month boundary UTC instants | Parsed instant consistent; no invalid date acceptance. |
| BE-04 | P0 | `parse_date` / `parse_time_hh_mm` invalid inputs | Rejection or error path used by callers; no undefined behavior. |
| BE-05 | P1 | `compute_sun_full` same instant as moon fixture | Altitude/azimuth in plausible ranges; deterministic across runs. |

### 5.2 Backend — HTTP API

| Case ID | Priority | Description | Expected result |
|---------|----------|-------------|-----------------|
| HTTP-01 | P0 | `GET /api/health` | **200**, JSON includes `status` (e.g. `ok` per README). |
| HTTP-02 | P0 | `GET /api/version` | **200**, `service` and `version` present. |
| HTTP-03 | P0 | `GET /api/moon` with valid `lat`, `lon`, `date`, optional `time` | **200**; body includes `instant_utc`, `location`, `phase`, `illumination`, `visibility`. |
| HTTP-04 | P0 | `POST /api/moon` with same parameters as HTTP-03 | **200**; semantically same as GET within float tolerance. |
| HTTP-05 | P0 | `GET` / `POST` `/api/sun` valid params | **200**; `position.azimuth_deg`, `position.altitude_deg` present. |
| HTTP-06 | P0 | Missing required parameter (e.g. no `date`) | **400**, `{"error":"..."}`. |
| HTTP-07 | P1 | Out-of-range `lat` or `lon` | **400** with clear error. |
| HTTP-08 | P1 | Malformed `date` or `time` string | **400**. |
| HTTP-09 | P2 | `OPTIONS` on `/api/moon` (and other documented routes) | Success for preflight as used by browsers. |

### 5.3 Frontend

| Case ID | Priority | Description | Expected result |
|---------|----------|-------------|-----------------|
| FE-01 | P0 | Submit with empty required fields | Submit disabled or validation message; no request. |
| FE-02 | P0 | Successful fetch | Moon and sun sections show data; no error banner. |
| FE-03 | P0 | API returns **400** or network failure | User-visible error from API body or generic message. |
| FE-04 | P1 | Timezone resolution success | Local time labels shown per Design. |
| FE-05 | P1 | Timezone lookup failure | Graceful UTC-only wording (Design). |
| FE-06 | P2 | Copy URL / curl helpers | Clipboard or feedback behavior per Design. |

### 5.4 Docker / deployment smoke

| Case ID | Priority | Description | Expected result |
|---------|----------|-------------|-----------------|
| DO-01 | P0 | `docker compose up --build` (or documented equivalent) | Container serves UI; `/api/health` returns OK. |
| DO-02 | P0 | `GET` sample `/api/moon` through mapped port | **200** and valid JSON. |

---

## 6. Execution schedule (suggested)

| Phase | Activities | Exit criterion |
|-------|--------------|----------------|
| **A — Core correctness** | Implement BE-01–BE-05, HTTP-01–HTTP-08 as automated tests where feasible | Ephemeris and API behaviors reproducible in CI or documented manual script. |
| **B — UI and integration** | FE-01–FE-05; optional E2E for one fixture | Demo path works on local dev and Docker. |
| **C — Hardening** | BE-02 polar cases, HTTP-09, FE-06; fuzz a small set of bad inputs | No crashes; errors remain JSON-shaped. |

Adjust phases to match course deadlines; **P0** cases should complete before final demo.

---

## 7. Entry and exit criteria

### 7.1 Entry (start testing a build)

- Code compiles: C++ `cmake` build; frontend `npm run build`.
- For API cases: `moon-api` running on a known port (or Docker stack up).
- Baseline fixtures checked in or documented for reproducibility.

### 7.2 Exit (ready for demo / submission)

- All **P0** automated cases pass (or P0 manual checklist signed off if automation is not yet implemented).
- No open **P0** defects for routes documented in README.
- **P1** failures documented with rationale or follow-up issues.

---

## 8. Roles and responsibilities (typical for a small team)

| Role | Responsibility |
|------|----------------|
| **Implementer** | Write features; add or update tests per this plan; fix failures. |
| **Reviewer** | Confirm P0 cases exist for changed areas; spot-check README vs behavior. |
| **Course / PM** | Accept exit criteria for graded milestones. |

For a solo project, one person covers all roles but still uses the checklists.

---

## 9. Deliverables

| Deliverable | Description |
|-------------|-------------|
| Automated tests | C++ test binary / `ctest`; frontend test script; optional API script. |
| CI configuration | Optional workflow running build + tests + smoke (see TestStrategy). |
| Runbook | README commands sufficient to run tests locally; this plan updated if cases change. |

---

## 10. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Float drift across platforms | Fix tolerance; avoid over-precise golden values from external almanacs. |
| No CI | Run P0 matrix manually before each submission; add CI when time allows. |
| E2E flakiness | Prefer API tests; keep E2E to one stable fixture. |
| Semantic misunderstanding (UTC day vs local) | Anchor tests to README “Time and semantics”; add fixture comments. |

---

## 11. Traceability

| Strategy objective | Plan sections |
|--------------------|----------------|
| Correctness | §2 T1–T4, §5 matrices |
| Regression safety | §4 unit/API, §5 BE/HTTP |
| Integration | §3 environments, §5.3 FE, §5.4 DO |
| Fast feedback | §4, §6 phase A |

---

## 12. Change log

| Date | Change |
|------|--------|
| *(initial)* | Test plan created; aligned with TestStrategy and README/Design. |
