// TestPlan FE-01–FE-06 coverage: see TestStrategy.md (Frontend representative unit tests).
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

const moonApiBody = {
  instant_utc: "2024-06-15T12:00:00Z",
  location: { latitude: 47.6062, longitude: -122.3321 },
  phase: {
    name: "Waxing Gibbous",
    cycle_fraction: 0.72,
    sun_moon_earth_angle_deg: 95.5,
  },
  illumination: { fraction: 0.98, percent: 98.0 },
  visibility: {
    state: "normal" as const,
    moonrise_utc: "2024-06-15T08:00:00Z",
    moonset_utc: "2024-06-16T04:00:00Z",
    hours_above_horizon: 12.34,
  },
};

const sunApiBody = {
  instant_utc: "2024-06-15T12:00:00Z",
  location: { latitude: 47.6062, longitude: -122.3321 },
  position: { azimuth_deg: -119.54, altitude_deg: 45.2 },
};

describe("App", () => {
  beforeEach(() => {
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
            new Response(JSON.stringify(moonApiBody), {
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the main heading and loads version from the API", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /moon tracker/i })).toBeInTheDocument();
    expect(await screen.findByText(/moon-api/)).toBeInTheDocument();
  });

  it("submits the form and shows moon phase from mocked API responses", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText(/moon-api/);

    await user.click(screen.getByRole("button", { name: /compute/i }));

    expect(await screen.findByText("Waxing Gibbous")).toBeInTheDocument();
    expect(screen.getByText(/Sun position/i)).toBeInTheDocument();
    // FE-04: local time labels when tz-lookup resolves for Seattle coordinates
    expect(screen.getAllByText(/Instant \(local\)/i).length).toBeGreaterThan(0);
  });

  // TestPlan FE-01 — empty required fields: no submit, helper text
  it("disables Compute and shows hint when latitude, longitude, or date is empty", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText(/moon-api/);

    const latInput = screen.getByLabelText(/latitude/i);
    await user.clear(latInput);

    const compute = screen.getByRole("button", { name: /compute/i });
    expect(compute).toBeDisabled();
    expect(screen.getByText(/Fill in latitude, longitude, and date to compute/i)).toBeInTheDocument();
  });

  // TestPlan FE-03 — API error surfaces in UI
  it("shows API error message when moon request fails", async () => {
    vi.unstubAllGlobals();
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
            new Response(JSON.stringify({ error: "invalid moon" }), {
              status: 400,
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

    const user = userEvent.setup();
    render(<App />);

    await screen.findByText(/moon-api/);
    await user.click(screen.getByRole("button", { name: /compute/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/invalid moon/i);
  });

  // TestPlan FE-05 — timezone lookup fails: UTC-only copy
  it("shows UTC-only copy when no timezone is found for coordinates", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText(/moon-api/);

    await user.clear(screen.getByLabelText(/latitude/i));
    await user.type(screen.getByLabelText(/latitude/i), "91");
    await user.clear(screen.getByLabelText(/longitude/i));
    await user.type(screen.getByLabelText(/longitude/i), "0");

    await user.click(screen.getByRole("button", { name: /compute/i }));

    expect(await screen.findByText(/No timezone found for these coordinates/i)).toBeInTheDocument();
  });

  // TestPlan FE-06 — copy URL feedback
  it("Copy URL updates feedback after moon URL copy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const user = userEvent.setup();
    render(<App />);

    await screen.findByText(/moon-api/);

    const copyButtons = screen.getAllByRole("button", { name: /copy url/i });
    await user.click(copyButtons[0]);

    expect(writeText).toHaveBeenCalled();
    expect(await screen.findByText(/^Copied$/)).toBeInTheDocument();
  });
});
