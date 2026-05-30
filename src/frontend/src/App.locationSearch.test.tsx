/**
 * Nominatim location search — empty results, HTTP errors, and network failures.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { resetNominatimClientForTests } from "./nominatim";

function versionResponse() {
  return new Response(JSON.stringify({ service: "moon-api", version: "1.1.0" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("location search (Nominatim)", () => {
  beforeEach(() => {
    resetNominatimClientForTests();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const raw = typeof input === "string" ? input : input.toString();
        if (raw.includes("/api/version")) return versionResponse();
        if (raw.includes("nominatim.openstreetmap.org")) {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("not found", { status: 404 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetNominatimClientForTests();
  });

  it("shows no-results copy when Nominatim returns an empty array", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByPlaceholderText(/city/i), "Nowhereville XYZ");
    await user.click(screen.getByRole("button", { name: /^search$/i }));

    expect(
      await screen.findByText(/No results found for "Nowhereville XYZ"/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/latitude/i)).toHaveValue("");
  });

  it("shows search-failed copy when Nominatim returns a non-OK status", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const raw = typeof input === "string" ? input : input.toString();
        if (raw.includes("/api/version")) return versionResponse();
        if (raw.includes("nominatim.openstreetmap.org")) {
          return new Response("rate limited", { status: 503 });
        }
        return new Response("not found", { status: 404 });
      }),
    );

    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByPlaceholderText(/city/i), "Paris");
    await user.click(screen.getByRole("button", { name: /^search$/i }));

    expect(
      await screen.findByText(/Search failed\. Check your connection or enter coordinates directly/i),
    ).toBeInTheDocument();
  });

  it("shows search-failed copy when the geocoder request throws (network)", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const raw = typeof input === "string" ? input : input.toString();
        if (raw.includes("/api/version")) return versionResponse();
        if (raw.includes("nominatim.openstreetmap.org")) {
          throw new TypeError("Failed to fetch");
        }
        return new Response("not found", { status: 404 });
      }),
    );

    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByPlaceholderText(/city/i), "Tokyo");
    await user.click(screen.getByRole("button", { name: /^search$/i }));

    expect(
      await screen.findByText(/Search failed\. Check your connection or enter coordinates directly/i),
    ).toBeInTheDocument();
  });
});
