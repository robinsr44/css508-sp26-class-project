/**
 * WCAG-oriented checks with axe-core (Vitest + jsdom). Mirrors E2E-03 without Playwright.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import App from "./App";

function computeButton(container: HTMLElement) {
  const form = container.querySelector("form.card");
  if (!form) throw new Error("Expected form.card");
  return within(form).getByRole("button", { name: /compute/i });
}

const moonOk = {
  instant_utc: "2024-06-15T12:00:00Z",
  location: { latitude: 47.6062, longitude: -122.3321 },
  phase: { name: "Full", cycle_fraction: 0.5, sun_moon_earth_angle_deg: 90 },
  illumination: { fraction: 1, percent: 100 },
  visibility: {
    state: "normal" as const,
    moonrise_utc: "2024-06-15T08:00:00Z",
    moonset_utc: "2024-06-16T04:00:00Z",
    hours_above_horizon: 10,
  },
};

const sunOk = {
  instant_utc: "2024-06-15T12:00:00Z",
  location: { latitude: 47.6062, longitude: -122.3321 },
  position: { azimuth_deg: 0, altitude_deg: 30 },
};

describe("App accessibility (axe)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/version")) {
          return Promise.resolve(
            new Response(JSON.stringify({ service: "moon-api", version: "1.0.0" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        if (url.includes("/api/moon")) {
          return Promise.resolve(
            new Response(JSON.stringify(moonOk), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        if (url.includes("/api/sun")) {
          return Promise.resolve(
            new Response(JSON.stringify(sunOk), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        return Promise.resolve(new Response("not found", { status: 404 }));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("has no axe violations on initial view (color-contrast checked in Playwright E2E-03)", async () => {
    const { container } = render(<App />);
    await screen.findByText(/moon-api/);
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  it("exposes main landmark and uniquely named copy buttons", async () => {
    render(<App />);
    await screen.findByText(/moon-api/);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("link", { name: /skip to main content/i })).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("button", { name: /copy moon api url/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy sun api url/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy version api url/i })).toBeInTheDocument();
  });

  it("has no axe violations after compute (color-contrast checked in Playwright E2E-03)", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByText(/moon-api/);
    await user.click(computeButton(container));
    await screen.findByRole("heading", { name: /^phase$/i });

    const results = await axe(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});
