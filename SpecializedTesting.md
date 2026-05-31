# Specialized Testing
Typically covers verification that goes beyond typical unit, integration, and functional testing. It aims to cover software qualities (i.e. performance, usability, compatability). It also ensures conformance with standards and regulations. The methods for testing may include load/stress testing, audits, beta testing.

## Common Issues Found In Production

- **Location search fails or is slow** — Slow or failed results. Per the requirements for using the 3rd party services there is a rate limit in place for searching location by city. Addionally, network blips could impact performance.

- **Failure when the API is down** — when `moon-api` or nginx/proxy are not running or misconfigured, users will see an error instead of the moon data.

- **Results look inconsistent on one page** — Phase name, illumination, the moon visual, and rise/set times can appear as inconsistent, based on the information that is being displayed. Additionally, all values are approximations so discrepencies are possible.

- **Usability for Searching** - There are two button clicks that are required if the user is seaching by location vs just lat/lon and that could cause some confusion.

- **Geolocation blocked** — Denying browser location permission (or using HTTP without a secure context) leaves coordinates empty until the user searches or types lat/lon manually.

- **Accessibility** - Some elements are difficult to track through using just keyboard or the screen-reader.

## Performance Testing
Automated performance checks run in the **Specialized Testing** GitHub Actions workflow ([`.github/workflows/specialized-testing.yml`](.github/workflows/specialized-testing.yml)). Local equivalents:

| Test | Script / command | Budget (default) | CI |
|------|------------------|------------------|-----|
| API cold start | `bash scripts/ci/specialized-cold-start.sh <moon-api-binary> [port]` | health within 5 s | Yes |
| API single-request latency | `bash scripts/ci/specialized-performance.sh [base_url]` | moon median ≤ 50 ms, p95 ≤ 200 ms (50 samples) | Yes |
| Parallel moon + sun | same script | wall clock ≤ 500 ms | Yes |
| Light concurrency | same script | 100 parallel moon GETs, p95 ≤ 500 ms | Yes |
| Production bundle size | `npm run build` then `bash scripts/ci/specialized-bundle-budget.sh` | JS+CSS ≤ 400 KiB raw, ≤ 120 KiB gzip | Yes |
| Time to interactive UI | `npm run test:specialized:e2e` (Playwright) | page ready ≤ 5 s | Yes |
| End-to-end compute delay | same Playwright suite | results visible ≤ 10 s after Compute | Yes |

From repo root with `moon-api` on port 8080: `bash scripts/ci/specialized-performance.sh`. From `src/frontend`: `npm run test:specialized:e2e` (starts Vite via Playwright config).

## Accessibility Testing
The footer claims WCAG 2.1 Level AA and Section 508 conformance (keyboard navigation, visible focus, screen-reader announcements, reduced motion). Automated checks run in Playwright (`accessibility.spec.ts`, `keyboard.spec.ts`) and related Vitest suites; remaining rows require manual or assistive-technology verification.

**Last automated run:** 4/4 Playwright a11y/keyboard E2E tests passed; related Vitest UX tests passed (local, 2026-05-30).

| Area | How to test | Automated / Manual | Pass? | Notes |
|------|-------------|-------------------|-------|-------|
| Automated axe scan | Run `npm run test:e2e -- e2e/accessibility.spec.ts` (moon-api on 8080). Scans the page on load and after Compute. | Automated | PASS | CI runs this with full E2E |
| Skip link | Press **Tab** once, then **Enter** on “Skip to main content.” Focus should jump to the main form area. | Automated | PASS | `accessibility.spec.ts` — CI |
| Keyboard tab order | Use **Tab** and **Shift+Tab** only—no mouse. Step through: skip link → search → Use my location → lat/lon → date → time → Local/UTC pills → Compute → results pills → disclaimer → footer. Nothing should be skipped or trap focus. | Manual | PASS | `keyboard.spec.ts` only covers part of this path |
| Visible focus indicators | Tab to each button and input. Each one should show a clear highlight ring—including **both** Local/UTC pill groups (time entry and results). | Manual | Partial PASS | Beta: pills may lack visible highlight |
| Pill button state | Click **Local** and **UTC** in both pill groups. Labels and times should update; the active choice should look selected. | Partial | PASS | Vitest + `keyboard.spec.ts`; visual focus not checked |
| Screen reader labels | Turn on **VoiceOver** (Mac) or **NVDA** (Windows). Tab through the form. Each field and button should be announced with a sensible name. | Manual | PASS | axe does not replace this |
| Live announcements | With screen reader on, run **Compute**, search a city, and click **Use my location**. Listen for spoken updates (e.g. “Computing…”, “Results ready”). | Manual | FAIL | Did not announce the results |
| Error announcements | Trigger errors: bad search, deny location, invalid coordinates, or stop the API. The screen reader should announce each error when it appears. | Partial | PASS | Vitest checks errors show on screen; not read aloud in CI |
| Results structure | After **Compute**, tab through results with screen reader on. You should hear “Moon results” / “Sun results” and the phase name. The moon picture should not get in the way. | Partial | PASS | axe after Compute passed; reading order not fully checked |
| Semantic landmarks | Check headings make sense top to bottom. Find the “Not for navigation” note. Open **Full disclaimer** using keyboard only (Space/Enter on the summary). | Partial | PASS | axe passed; `<details>` keyboard not fully exercised |
| Color contrast | Eyeball text, hints, errors, and pill buttons on the dark background—can you read everything easily? | Manual | N/A | axe contrast check is turned off |
| Zoom (200%) | Set browser zoom to **200%**. You should still reach every control without sideways scrolling or clipped text. | Manual | PASS | |
| Reduced motion | Turn on **Reduce motion** in OS settings, reload the app. Skip-link slide and moon animation should be minimal or off. | Manual | PASS | |
| Form validation UX | Try **Compute** with no location, bad lat/lon, and missing date. Each problem should show a clear message; **Compute** should look disabled when date is empty. | Partial | PASS | Covered by Vitest for on-screen messages |

## Cross-Browser Compatibility
My testing in Plywright E2E includes testing in Chromium, but there are other common browsers that should be included in the testing. The ones that I will include are Firefox and Safari.

| Attribute | What to verify | Chromium | Firefox | Safari |
|-----------|----------------|----------|---------|--------|
| Page layout | Header, form, and results panels render without overlap, clipping, or horizontal scroll at a typical desktop width | PASS | PASS | PASS |
| Date input | Native date picker accepts `YYYY-MM-DD`, shows the chosen value, and submits correctly | PASS | PASS | PASS |
| Time input (HH:MM) | Custom time field accepts 24-hour input, validates on blur, and preserves value after Compute | PASS | PASS | PASS |
| Coordinate inputs | Latitude/longitude fields accept decimal values and reject invalid input with a clear error | PASS | PASS | PASS |
| Location search | City/place search calls Nominatim, fills lat/lon, and shows the resolved place name | PASS | PASS | PASS |
| Use my location | Geolocation permission prompt works; granted access fills coordinates; denial shows an error | PASS | PASS | PASS |
| Compute & API | Submit fetches moon and sun in parallel; loading state appears; phase, illumination, visibility, and sun position render | PASS | PASS | PASS |
| Moon phase SVG | Phase disk graphic renders correctly for crescent, quarter, gibbous, and full phases | PASS | PASS | PASS |
| Local / UTC switchers (entry) | Time-entry pills toggle labels and convert date/time when a timezone is known | PASS | PASS | PASS |
| Local / UTC switchers (results) | Results pills relabel moon, sun, and visibility timestamps without breaking values | PASS | PASS | PASS |
| Timezone display | Local civil times match the location’s IANA zone; UTC fallback when timezone lookup fails | PASS | PASS | PASS |
| Error states | Failed search, geolocation, or API calls show readable inline errors (not blank UI) | PASS | PASS | PASS |
| Disclaimer UI | “Full disclaimer” `<details>` expands and collapses; navigation disclaimer remains visible | PASS | PASS | PASS |

## Beta Testing Feedback

Good:
- Tested a few days with a few different locations, all worked
- South pole and north pole both worked and gave useful descriptions ("doesn't set" etc.)
- Usability and discoverability of features was intuitive
- Looks swanky

Bad:
- There were a lot of disclaimers and jargon
- The accessability claims were not quite true - keyboard navigation does not correctly highlight within the two UTC/Local Time switchers (all the other input elements were highlighted correctly)
- More details about the sun on the selected day/location would be cool... but then it wouldn't be just a "moon tracker" anymore ¯\_(ツ)_/¯

