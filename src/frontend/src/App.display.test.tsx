/**
 * Local + UTC labels on moon, visibility, and sun (TestPlan FE-09).
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { within } from "@testing-library/react";

import App from "./App";
import { formatUtcIsoInZone, getPrimaryTimeZone } from "./locationTime";

function computeButton(container: HTMLElement) {
  const form = container.querySelector("form.card");
  if (!form) throw new Error("Expected form.card");
  return within(form).getByRole("button", { name: /compute/i });
}

describe("Local and UTC display (FE-09)", () => {
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
            new Response(
              JSON.stringify({
                instant_utc: "2024-06-15T12:00:00Z",
                location: { latitude: 47.6062, longitude: -122.3321 },
                phase: { name: "Full", cycle_fraction: 0.5, sun_moon_earth_angle_deg: 90 },
                illumination: { fraction: 1, percent: 100 },
                visibility: {
                  state: "normal",
                  moonrise_utc: "2024-06-15T08:00:00Z",
                  moonset_utc: "2024-06-16T04:00:00Z",
                },
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            ),
          );
        }
        if (url.includes("/api/sun")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                instant_utc: "2024-06-15T14:30:00Z",
                location: { latitude: 47.6062, longitude: -122.3321 },
                position: { azimuth_deg: 10, altitude_deg: 40 },
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            ),
          );
        }
        return Promise.resolve(new Response("not found", { status: 404 }));
      }),
    );
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

  it("shows local and UTC instants for moon, visibility, and sun", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByText(/moon-api/);
    await user.click(computeButton(container));

    const tz = getPrimaryTimeZone(47.6062, -122.3321);
    expect(tz).toBeTruthy();

    expect((await screen.findAllByText(/Instant \(local\)/i)).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Instant \(UTC\):\s*2024-06-15T12:00:00Z/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Instant \(UTC\):\s*2024-06-15T14:30:00Z/i)).toBeInTheDocument();
    expect(screen.getByText(/Moonrise \(local\)/i)).toBeInTheDocument();
    expect(screen.getByText(formatUtcIsoInZone("2024-06-15T08:00:00Z", tz!))).toBeInTheDocument();
    expect(screen.getByText(/UTC: moonrise 2024-06-15T08:00:00Z/)).toBeInTheDocument();
  });

  it("shows raw JSON when the checkbox is enabled", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByText(/moon-api/);
    await user.click(computeButton(container));

    await screen.findByText("Full");
    await user.click(screen.getByRole("checkbox", { name: /show raw json/i }));

    expect(screen.getByText(/GET \/api\/moon/i)).toBeInTheDocument();
    expect(screen.getByText(/GET \/api\/sun/i)).toBeInTheDocument();
    expect(screen.getByText(/"cycle_fraction": 0.5/)).toBeInTheDocument();
  });
});
