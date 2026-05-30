import { describe, expect, it } from "vitest";

import { hoursAboveHorizonText } from "./visibilityText";

describe("hoursAboveHorizonText", () => {
  it.each([
    [0, "less than an hour"],
    [0.4, "less than an hour"],
    [0.6, "about 1 hour"],
    [1, "about 1 hour"],
    [1.4, "about 1 hour"],
    [1.6, "about 2 hours"],
    [12.34, "about 12 hours"],
    [12.6, "about 13 hours"],
  ] as const)("rounds %s hours to %s", (hours, expected) => {
    expect(hoursAboveHorizonText(hours)).toBe(expected);
  });
});
