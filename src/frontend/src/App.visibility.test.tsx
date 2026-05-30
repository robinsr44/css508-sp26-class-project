/**
 * Visibility UI: moonrise/moonset, hours above horizon, polar copy, Local/UTC labels.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { formatInstantForDisplay, getPrimaryTimeZone } from "./locationTime";
import { seedSeattleCoordinates } from "./test/locationForm";
import { resultTimeDisplayGroup } from "./test/timeToggle";

function computeButton(container: HTMLElement) {
  const form = container.querySelector("form.card");
  if (!form) throw new Error("Expected form.card");
  return within(form).getByRole("button", { name: /compute/i });
}

const sunApiBody = {
  instant_utc: "2024-06-15T12:00:00Z",
  location: { latitude: 47.6062, longitude: -122.3321 },
  position: { azimuth_deg: -119.54, altitude_deg: 45.2 },
};

function stubFetch(moonBody: object) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/version")) {
        return Promise.resolve(
          new Response(JSON.stringify({ service: "moon-api", version: "1.1.0" }), {
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
          new Response(JSON.stringify(sunApiBody), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.resolve(new Response("not found", { status: 404 }));
    }),
  );
}

describe("App visibility UI", () => {
  beforeEach(() => {
    stubFetch({
      instant_utc: "2024-06-15T12:00:00Z",
      location: { latitude: 47.6062, longitude: -122.3321 },
      phase: { name: "Waxing Gibbous", cycle_fraction: 0.72, sun_moon_earth_angle_deg: 95.5 },
      illumination: { fraction: 0.98, percent: 98.0 },
      visibility: {
        state: "normal",
        moonrise_utc: "2024-06-15T08:00:00Z",
        moonset_utc: "2024-06-16T04:00:00Z",
        hours_above_horizon: 12.34,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows moonrise, moonset, and hours above horizon for normal visibility", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await seedSeattleCoordinates(user);
    await user.click(computeButton(container));

    const block = screen.getByRole("heading", { name: /^visibility$/i }).closest(".result-item");
    expect(block).toBeTruthy();

    const tz = getPrimaryTimeZone(47.6062, -122.3321);
    expect(within(block!).getByText(/^Moonrise:/i)).toBeInTheDocument();
    expect(within(block!).getByText(/^Moonset:/i)).toBeInTheDocument();
    expect(
      within(block!).getByText(formatInstantForDisplay("2024-06-15T08:00:00Z", false, tz)),
    ).toBeInTheDocument();
    expect(within(block!).getByText(/Above the horizon for about 12 hours/i)).toBeInTheDocument();
  });

  it("shows polar always_up copy", async () => {
    vi.unstubAllGlobals();
    stubFetch({
      instant_utc: "2024-07-01T12:00:00Z",
      location: { latitude: 89, longitude: 0 },
      phase: { name: "Full", cycle_fraction: 0.5, sun_moon_earth_angle_deg: 180 },
      illumination: { fraction: 0.99, percent: 99 },
      visibility: { state: "always_up" },
    });

    const user = userEvent.setup();
    const { container } = render(<App />);
    await seedSeattleCoordinates(user);
    await user.click(computeButton(container));

    expect(
      await screen.findByText(/The moon is above the horizon all day/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Moonrise:/i)).not.toBeInTheDocument();
  });

  it("shows polar always_down copy", async () => {
    vi.unstubAllGlobals();
    stubFetch({
      instant_utc: "2024-01-15T12:00:00Z",
      location: { latitude: 89, longitude: 0 },
      phase: { name: "New", cycle_fraction: 0, sun_moon_earth_angle_deg: 0 },
      illumination: { fraction: 0.01, percent: 1 },
      visibility: { state: "always_down" },
    });

    const user = userEvent.setup();
    const { container } = render(<App />);
    await seedSeattleCoordinates(user);
    await user.click(computeButton(container));

    expect(
      await screen.findByText(/The moon is below the horizon all day/i),
    ).toBeInTheDocument();
  });

  it("toggles moonrise/moonset labels between Local and UTC", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await seedSeattleCoordinates(user);
    await user.click(computeButton(container));

    const block = await screen.findByRole("heading", { name: /^visibility$/i });
    expect(block.closest(".result-item")).toBeTruthy();
    expect(screen.getByText(/^Moonrise:/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Moonrise \(UTC\)/i)).not.toBeInTheDocument();

    await user.click(resultTimeDisplayGroup().getByRole("button", { name: /^UTC$/ }));
    expect(screen.getByText(/^Moonrise \(UTC\)/i)).toBeInTheDocument();
    expect(screen.getByText(/^Moonset \(UTC\)/i)).toBeInTheDocument();

    await user.click(resultTimeDisplayGroup().getByRole("button", { name: /^Local$/ }));
    expect(screen.getByText(/^Moonrise:/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Moonrise \(UTC\)/i)).not.toBeInTheDocument();
  });

  it("toggles sun position time label with the global Local/UTC pill", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await seedSeattleCoordinates(user);
    await user.click(computeButton(container));

    const sunBlock = screen.getByRole("heading", { name: /^sun position$/i }).closest(".result-item");
    expect(sunBlock).toBeTruthy();
    expect(within(sunBlock!).getByText(/^Local time:/i)).toBeInTheDocument();

    await user.click(resultTimeDisplayGroup().getByRole("button", { name: /^UTC$/ }));
    expect(within(sunBlock!).getByText(/^UTC:/i)).toBeInTheDocument();

    await user.click(resultTimeDisplayGroup().getByRole("button", { name: /^Local$/ }));
    expect(within(sunBlock!).getByText(/^Local time:/i)).toBeInTheDocument();
  });
});
