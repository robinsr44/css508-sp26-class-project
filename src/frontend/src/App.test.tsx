import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ service: "moon-api", version: "1.1.0" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
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
});
