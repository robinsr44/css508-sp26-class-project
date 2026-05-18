import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import type { MoonApiResponse, SunApiResponse } from "./api";

function computeBtn(container: HTMLElement) {
  const form = container.querySelector("form.card");
  if (!form) throw new Error("Expected form.card");
  return within(form).getByRole("button", { name: /compute/i });
}

const moonOk: MoonApiResponse = {
  instant_utc: "2026-03-15T12:00:00Z",
  location: { latitude: 47.6062, longitude: -122.3321 },
  phase: { name: "Full", cycle_fraction: 0.5, sun_moon_earth_angle_deg: 180 },
  illumination: { fraction: 1, percent: 100 },
  visibility: { state: "always_down" },
};

const sunOk: SunApiResponse = {
  instant_utc: "2026-03-15T12:00:00Z",
  location: { latitude: 47.6062, longitude: -122.3321 },
  position: { azimuth_deg: 10.5, altitude_deg: 45.2 },
};

describe("API resilience (Promise.all moon + sun)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows error and no moon card when moon fails but sun succeeds", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/moon")) {
          return new Response(JSON.stringify({ error: "moon rejected" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url.includes("/api/sun")) {
          return new Response(JSON.stringify(sunOk), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("not found", { status: 404 });
      }),
    );

    const { container } = render(<App />);
    await user.click(computeBtn(container));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/moon rejected/i);
    expect(screen.queryByRole("heading", { name: /^phase$/i })).not.toBeInTheDocument();
  });

  it("shows error and no sun card when sun fails but moon succeeds", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/moon")) {
          return new Response(JSON.stringify(moonOk), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url.includes("/api/sun")) {
          return new Response(JSON.stringify({ error: "sun rejected" }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("not found", { status: 404 });
      }),
    );

    const { container } = render(<App />);
    await user.click(computeBtn(container));

    expect(await screen.findByRole("alert")).toHaveTextContent(/sun rejected/i);
    expect(screen.queryByRole("heading", { name: /^sun position$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^phase$/i })).not.toBeInTheDocument();
  });
});
