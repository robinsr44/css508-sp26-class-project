/**
 * High-priority visibility UI (TestPlan FE-07).
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import type { MoonApiResponse } from "./api";
import { formatUtcIsoInZone, getPrimaryTimeZone } from "./locationTime";

function computeButton(container: HTMLElement) {
  const form = container.querySelector("form.card");
  if (!form) throw new Error("Expected form.card");
  return within(form).getByRole("button", { name: /compute/i });
}

const sunOk = {
  instant_utc: "2024-06-15T12:00:00Z",
  location: { latitude: 47.6062, longitude: -122.3321 },
  position: { azimuth_deg: -119.54, altitude_deg: 45.2 },
};

function stubFetch(moonBody: MoonApiResponse) {
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
          new Response(JSON.stringify(moonBody), {
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
}

describe("Visibility results (FE-07)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "navigator",
      new Proxy(globalThis.navigator, {
        get(target, prop, receiver) {
          if (prop === "clipboard") {
            return { writeText: vi.fn().mockResolvedValue(undefined) };
          }
          return Reflect.get(target, prop, receiver);
        },
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows moonrise, moonset, hours, and UTC reference for normal visibility", async () => {
    const moonrise = "2024-06-15T08:00:00Z";
    const moonset = "2024-06-16T04:00:00Z";
    stubFetch({
      instant_utc: "2024-06-15T12:00:00Z",
      location: { latitude: 47.6062, longitude: -122.3321 },
      phase: { name: "Waxing Gibbous", cycle_fraction: 0.72, sun_moon_earth_angle_deg: 95.5 },
      illumination: { fraction: 0.98, percent: 98.0 },
      visibility: {
        state: "normal",
        moonrise_utc: moonrise,
        moonset_utc: moonset,
        hours_above_horizon: 12.34,
      },
    });

    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByText(/moon-api/);
    await user.click(computeButton(container));

    expect(await screen.findByRole("heading", { name: /^visibility$/i })).toBeInTheDocument();
    const tz = getPrimaryTimeZone(47.6062, -122.3321);
    expect(tz).toBeTruthy();
    expect(screen.getByText(formatUtcIsoInZone(moonrise, tz!))).toBeInTheDocument();
    expect(screen.getByText(formatUtcIsoInZone(moonset, tz!))).toBeInTheDocument();
    expect(screen.getByText(/Hours above horizon:\s*12\.34/)).toBeInTheDocument();
    expect(screen.getByText(/UTC: moonrise/)).toHaveTextContent(moonrise);
    expect(screen.getByText(/UTC: moonrise/)).toHaveTextContent(moonset);
  });

  it("shows polar always_up copy", async () => {
    stubFetch({
      instant_utc: "2024-01-15T12:00:00Z",
      location: { latitude: 89, longitude: 0 },
      phase: { name: "Full", cycle_fraction: 0.5, sun_moon_earth_angle_deg: 90 },
      illumination: { fraction: 1, percent: 100 },
      visibility: { state: "always_up" },
    });

    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByText(/moon-api/);
    await user.click(computeButton(container));

    expect(
      await screen.findByText(/Moon continuously above horizon that day/i),
    ).toBeInTheDocument();
  });

  it("shows polar always_down copy", async () => {
    stubFetch({
      instant_utc: "2024-01-15T12:00:00Z",
      location: { latitude: 89, longitude: 0 },
      phase: { name: "New", cycle_fraction: 0, sun_moon_earth_angle_deg: 0 },
      illumination: { fraction: 0, percent: 0 },
      visibility: { state: "always_down" },
    });

    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByText(/moon-api/);
    await user.click(computeButton(container));

    expect(
      await screen.findByText(/Moon continuously below horizon that day/i),
    ).toBeInTheDocument();
  });
});
