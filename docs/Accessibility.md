# Accessibility conformance notes

Moon Tracker targets **WCAG 2.1 Level AA**, aligned with **Section 508** (WCAG 2.0 AA baseline) and common course requirements for CSS 508.

## Automated checks

| Layer | Command | What it covers |
|-------|---------|----------------|
| Vitest + axe | `cd src/frontend && npm test -- src/App.a11y.test.tsx` | Structure, labels, ARIA, duplicate controls (color contrast verified in Playwright) |
| Playwright + axe | `npm run test:e2e` (see [E2ETestPlan.md](../E2ETestPlan.md) E2E-03) | Full page in Chromium, **including color-contrast** |
| Keyboard | E2E-03 Enter submits Compute when the button is focused |

## UI patterns implemented

- **Skip link** to `#main-content`
- **`<main>`** landmark wrapping primary content
- **Labels** on all form fields; errors use `role="alert"`
- **Loading** announced via `aria-busy` on the form and a polite `role="status"` live region
- **Results** in named `<section>` elements with `aria-live="polite"` on moon results
- **Distinct names** on the three “Copy URL” buttons (`aria-label`)
- **Visible focus** rings on inputs, buttons, and summary controls
- **Contrast-safe** text tokens in `index.css` for dark theme

## Manual checks (recommended before submission)

1. Tab through the full flow: skip link → fields → Compute → results → copy buttons → raw JSON toggle.
2. Use VoiceOver (macOS) or NVDA (Windows): confirm phase name and moonrise/moonset are read after Compute.
3. Zoom to 200%: layout remains usable (single column on narrow widths).
4. Verify you can complete the task without a mouse.

## Known limits

- Ephemeris output is **educational**, not for navigation; see the collapsible **Disclaimer** (summary line visible when closed) and README.
- **Color contrast** in jsdom unit tests is disabled (axe needs canvas); Playwright E2E-03 is the source of truth for contrast.
- Location search / geolocation (FE-11, FE-12) are not in the UI yet; add axe + keyboard tests when those ship.

## References

- [WCAG 2.1](https://www.w3.org/TR/WCAG21/)
- [Section 508 applicability](https://www.section508.gov/develop/applicability-conformance/)
- [Deque axe rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
