/**
 * Form UX — medium priority (TestPlan FE-10).
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
  visibility: { state: "normal" as const, moonrise_utc: "2024-06-15T08:00:00Z" },
};

const sunOk = {
  instant_utc: "2024-06-15T12:00:00Z",
  location: { latitude: 47.6062, longitude: -122.3321 },
  position: { azimuth_deg: 0, altitude_deg: 30 },
};

function stubVersionAndApis(
  moonHandler: (url: string) => Response | Promise<Response>,
) {
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
      if (url.includes("/api/moon")) return Promise.resolve(moonHandler(url));
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

describe("Form UX (FE-10)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows error when latitude and longitude are not valid numbers", async () => {
    stubVersionAndApis(() =>
      new Response(JSON.stringify(moonOk), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByText(/moon-api/);

    await user.clear(screen.getByLabelText(/latitude/i));
    await user.type(screen.getByLabelText(/latitude/i), "not-a-number");
    await user.click(computeButton(container));

    expect(await screen.findByRole("alert")).toHaveTextContent(/valid numbers/i);
    expect(screen.queryByText(/^Phase$/i)).not.toBeInTheDocument();
  });

  it("shows Computing… and disables submit while requests are in flight", async () => {
    let resolveMoon!: (r: Response) => void;
    const moonPending = new Promise<Response>((resolve) => {
      resolveMoon = resolve;
    });

    stubVersionAndApis(() => moonPending);

    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByText(/moon-api/);

    const compute = computeButton(container);
    await user.click(compute);

    expect(compute).toHaveTextContent(/computing/i);
    expect(compute).toBeDisabled();

    resolveMoon(
      new Response(JSON.stringify(moonOk), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(await screen.findByText("Full")).toBeInTheDocument();
    expect(compute).toHaveTextContent(/^compute$/i);
    expect(compute).not.toBeDisabled();
  });

  it("clears prior results when a second submit fails", async () => {
    let call = 0;
    stubVersionAndApis(() => {
      call += 1;
      if (call === 1) {
        return new Response(JSON.stringify(moonOk), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "moon failed on retry" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    });

    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByText(/moon-api/);

    await user.click(computeButton(container));
    expect(await screen.findByText("Full")).toBeInTheDocument();

    await user.click(computeButton(container));
    expect(await screen.findByRole("alert")).toHaveTextContent(/moon failed on retry/i);
    expect(screen.queryByRole("heading", { name: /^phase$/i })).not.toBeInTheDocument();
  });
});
