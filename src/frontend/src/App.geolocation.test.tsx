import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import type { MoonApiResponse, SunApiResponse } from "./api";

function computeBtn(container: HTMLElement) {
  const form = container.querySelector("form.card");
  if (!form) throw new Error("Expected form.card");
  return within(form).getByRole("button", { name: /compute/i });
}

const moonOk: MoonApiResponse = {
  instant_utc: "2026-03-15T12:00:00Z",
  location: { latitude: 40.7128, longitude: -74.006 },
  phase: { name: "Full", cycle_fraction: 0.5, sun_moon_earth_angle_deg: 180 },
  illumination: { fraction: 1, percent: 100 },
  visibility: { state: "always_down" },
};

const sunOk: SunApiResponse = {
  instant_utc: "2026-03-15T12:00:00Z",
  location: { latitude: 40.7128, longitude: -74.006 },
  position: { azimuth_deg: 0, altitude_deg: 30 },
};

describe("Use my location", () => {
  beforeEach(() => {
    Object.defineProperty(global.navigator, "geolocation", {
      configurable: true,
      writable: true,
      value: {
        getCurrentPosition: vi.fn((success: PositionCallback) => {
          success({
            coords: {
              latitude: 40.7128,
              longitude: -74.006,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          } as GeolocationPosition);
        }),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, "geolocation");
  });

  it("fills latitude and longitude from geolocation callback", async () => {
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
          return new Response(JSON.stringify(sunOk), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("not found", { status: 404 });
      }),
    );

    const { container } = render(<App />);

    await user.click(screen.getByRole("button", { name: /use my location/i }));

    expect(screen.getByLabelText(/latitude/i)).toHaveValue("40.7128");
    expect(screen.getByLabelText(/longitude/i)).toHaveValue("-74.0060");

    await user.click(computeBtn(container));
    await screen.findByRole("heading", { name: /^phase$/i });
  });
});
