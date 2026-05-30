/**
 * Parallel moon+sun fetch resilience (TestPlan FE-08).
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  visibility: { state: "always_down" as const },
};

const sunOk = {
  instant_utc: "2024-06-15T12:00:00Z",
  location: { latitude: 47.6062, longitude: -122.3321 },
  position: { azimuth_deg: 0, altitude_deg: 30 },
};

describe("API resilience (FE-08)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows error and no phase when moon fails but sun succeeds", async () => {
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
            new Response(JSON.stringify({ error: "moon rejected" }), {
              status: 400,
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

    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByText(/moon-api/);
    await user.click(computeButton(container));

    expect(await screen.findByRole("alert")).toHaveTextContent(/moon rejected/i);
    expect(screen.queryByText(/^Phase$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sun position/i)).not.toBeInTheDocument();
  });

  it("shows error and no sun section when sun fails but moon succeeds", async () => {
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
            new Response(JSON.stringify({ error: "sun rejected" }), {
              status: 502,
              headers: { "Content-Type": "application/json" },
            }),
          );
        }
        return Promise.resolve(new Response("not found", { status: 404 }));
      }),
    );

    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByText(/moon-api/);
    await user.click(computeButton(container));

    expect(await screen.findByRole("alert")).toHaveTextContent(/sun rejected/i);
    expect(screen.queryByText(/^Phase$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sun position/i)).not.toBeInTheDocument();
  });
});
