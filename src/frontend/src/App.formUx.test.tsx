/**
 * Form validation and submit UX: invalid coordinates, loading state, failed re-submit.
 */
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
  instant_utc: "2026-04-05T12:00:00Z",
  location: { latitude: 47.6062, longitude: -122.3321 },
  phase: { name: "Full", cycle_fraction: 0.5, sun_moon_earth_angle_deg: 180 },
  illumination: { fraction: 0.99, percent: 99 },
  visibility: { state: "always_down" },
};

const sunOk: SunApiResponse = {
  instant_utc: "2026-04-05T12:00:00Z",
  location: { latitude: 47.6062, longitude: -122.3321 },
  position: { azimuth_deg: 10, altitude_deg: 45 },
};

describe("form validation and submit UX", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows an error when latitude or longitude is not numeric on submit", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.clear(screen.getByLabelText(/latitude/i));
    await user.type(screen.getByLabelText(/latitude/i), "not-a-number");
    await user.click(computeBtn(container));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Latitude and longitude must be valid numbers/i);
  });

  it("disables Compute and shows Computing… while requests are in flight", async () => {
    let resolveMoon!: () => void;
    const moonGate = new Promise<void>((r) => {
      resolveMoon = r;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/moon")) {
          await moonGate;
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

    const user = userEvent.setup();
    const { container } = render(<App />);

    const compute = computeBtn(container);
    await user.click(compute);

    expect(compute).toBeDisabled();
    expect(compute).toHaveTextContent(/Computing…/i);

    resolveMoon();
    await screen.findByRole("heading", { name: /^phase$/i });
    expect(compute).not.toBeDisabled();
    expect(compute).toHaveTextContent(/^Compute$/i);
  });

  it("clears prior results when a second submit fails after a successful run", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        call += 1;
        if (url.includes("/api/moon")) {
          if (call <= 2) {
            return new Response(JSON.stringify(moonOk), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ error: "moon failed on retry" }), {
            status: 502,
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

    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(computeBtn(container));
    expect(await screen.findByRole("heading", { name: /^phase$/i })).toBeInTheDocument();

    await user.click(computeBtn(container));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/moon failed on retry/i);
    expect(screen.queryByRole("heading", { name: /^phase$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^sun position$/i })).not.toBeInTheDocument();
  });
});
