# Manual testing — lunar cycle (MANUAL-01)

Automated Vitest and Playwright tests cover API contracts and UI wiring. **Visual phase accuracy** over a full synodic month is still validated manually.

## Scope (Suite H)

| Item | Procedure |
|------|-----------|
| **Location** | One fixed site (e.g. Seattle: `47.6062`, `-122.3321`). |
| **Time** | UTC noon (`12:00`) each day. |
| **Span** | ~29 consecutive UTC calendar days (one lunar cycle). |
| **Check** | Phase name and illumination % look plausible vs. a calendar or almanac. |

## When to run

- Before a major demo or submission if ephemeris code changed.
- After changing `moon_ephemeris.cpp` or phase display logic.

## Record

Keep notes or screenshots in your coursework folder (e.g. `Manual E2E Testing - Moon Phase Detection.pdf`). This is **not** a CI gate.

## Automation boundary

Regression safety for the same dates is partially covered by backend **ctest** and **`live-moon-fixture.sh`**. Manual Suite H remains the acceptance check for **visual** phase correctness.
