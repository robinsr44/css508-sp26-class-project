/**
 * Local vs UTC time entry for destination coordinates.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import type { MoonApiResponse, SunApiResponse } from "./api";
import { getPrimaryTimeZone, localWallClockToUtc } from "./locationTime";
import { fillCoordinates, seedSeattleCoordinates } from "./test/locationForm";
import { formTimeEntryGroup } from "./test/timeToggle";

const moonOk: MoonApiResponse = {
  instant_utc: "2024-06-15T16:00:00Z",
  location: { latitude: 37.5407, longitude: -77.436 },
  phase: { name: "Full", cycle_fraction: 0.5, sun_moon_earth_angle_deg: 180 },
  illumination: { fraction: 0.99, percent: 99 },
  visibility: { state: "always_down" },
};

const sunOk: SunApiResponse = {
  instant_utc: "2024-06-15T16:00:00Z",
  location: { latitude: 37.5407, longitude: -77.436 },
  position: { azimuth_deg: 10, altitude_deg: 45 },
};

function stubFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
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
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  });
}

function computeButton(container: HTMLElement) {
  const form = container.querySelector("form.card");
  if (!form) throw new Error("Expected form.card");
  return form.querySelector("button[type='submit']") as HTMLButtonElement;
}

describe("local time entry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to local time labels once a location is set", async () => {
    const user = userEvent.setup();
    render(<App />);
    await seedSeattleCoordinates(user);
    expect(screen.getByLabelText(/^time \(local\)$/i)).toBeInTheDocument();
    expect(formTimeEntryGroup().getByRole("button", { name: /^Local$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("sends UTC derived from Richmond, VA local wall clock", async () => {
    const fetchMock = stubFetch();
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    const { container } = render(<App />);

    await fillCoordinates(user, "37.5407", "-77.4360");

    await user.clear(screen.getByLabelText(/^date(\s*\(local\)|\s*\(UTC\))?$/i));
    await user.type(screen.getByLabelText(/^date(\s*\(local\)|\s*\(UTC\))?$/i), "2024-06-15");
    await user.clear(screen.getByLabelText(/^time(\s*\(local\)|\s*\(UTC\))?$/i));
    await user.type(screen.getByLabelText(/^time(\s*\(local\)|\s*\(UTC\))?$/i), "12:00");

    await user.click(computeButton(container));

    const tz = getPrimaryTimeZone(37.5407, -77.436);
    expect(tz).toMatch(/New_York/);
    const expected = localWallClockToUtc("2024-06-15", "12:00", tz!);
    expect(expected).toEqual({ dateUtc: "2024-06-15", timeUtc: "16:00" });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const apiUrl = String(fetchMock.mock.calls.find(([u]) => String(u).includes("/api/moon"))?.[0]);
    expect(apiUrl).toContain("date=2024-06-15");
    expect(apiUrl).toContain("time=16%3A00");
  });

  it("sends UTC derived from Sunnyvale, CA local wall clock", async () => {
    const fetchMock = stubFetch();
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    const { container } = render(<App />);

    await fillCoordinates(user, "37.3688", "-122.0363");

    await user.clear(screen.getByLabelText(/^date(\s*\(local\)|\s*\(UTC\))?$/i));
    await user.type(screen.getByLabelText(/^date(\s*\(local\)|\s*\(UTC\))?$/i), "2024-06-15");
    await user.clear(screen.getByLabelText(/^time(\s*\(local\)|\s*\(UTC\))?$/i));
    await user.type(screen.getByLabelText(/^time(\s*\(local\)|\s*\(UTC\))?$/i), "12:00");

    await user.click(computeButton(container));

    const tz = getPrimaryTimeZone(37.3688, -122.0363);
    expect(tz).toMatch(/Los_Angeles/);
    const expected = localWallClockToUtc("2024-06-15", "12:00", tz!);
    expect(expected).toEqual({ dateUtc: "2024-06-15", timeUtc: "19:00" });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const apiUrl = String(fetchMock.mock.calls.find(([u]) => String(u).includes("/api/moon"))?.[0]);
    expect(apiUrl).toContain("time=19%3A00");
  });
});
