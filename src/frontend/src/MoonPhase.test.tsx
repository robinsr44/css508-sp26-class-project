import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MoonPhase, {
  illuminationIndicatesFullMoon,
  illuminationIndicatesNewMoon,
} from "./MoonPhase";

describe("illuminationIndicatesNewMoon", () => {
  it.each([
    [0, undefined, true],
    [0.009, undefined, true],
    [0.01, undefined, false],
    [0.5, 0.5, true],
    [0.5, 1, false],
    [Number.NaN, undefined, false],
  ] as const)("fraction=%s percent=%s → %s", (fraction, percent, expected) => {
    expect(illuminationIndicatesNewMoon(fraction, percent)).toBe(expected);
  });
});

describe("illuminationIndicatesFullMoon", () => {
  it.each([
    [1, undefined, true],
    [0.991, undefined, true],
    [0.99, undefined, false],
    [0.5, 99.0, false],
    [0.5, 99.5, true],
    [0.5, 99.1, true],
    [Number.NaN, undefined, false],
  ] as const)("fraction=%s percent=%s → %s", (fraction, percent, expected) => {
    expect(illuminationIndicatesFullMoon(fraction, percent)).toBe(expected);
  });
});

describe("MoonPhase SVG", () => {
  it("renders solid lit disk when illumination is in the Full band", () => {
    const { container } = render(
      <MoonPhase cycleFraction={0.5} illuminationFraction={0.995} illuminationPercent={99.5} />,
    );
    expect(container.querySelector("circle.moon-lit-face")).toBeTruthy();
    expect(container.querySelector("path.moon-lit-face")).toBeFalsy();
  });

  it("renders no lit face when illumination is in the New band", () => {
    const { container } = render(
      <MoonPhase cycleFraction={0.02} illuminationFraction={0.005} illuminationPercent={0.5} />,
    );
    expect(container.querySelector(".moon-lit-face")).toBeFalsy();
  });

  it("uses a direct lit path when waxing (cycle_fraction < 0.5)", () => {
    const { container } = render(
      <MoonPhase cycleFraction={0.25} illuminationFraction={0.25} illuminationPercent={25} />,
    );
    const path = container.querySelector("path.moon-lit-face");
    expect(path).toBeTruthy();
    expect(container.querySelector('g[transform*="scale(-1 1)"]')).toBeFalsy();
  });

  it("mirrors the lit path when waning (cycle_fraction ≥ 0.5)", () => {
    const { container } = render(
      <MoonPhase cycleFraction={0.75} illuminationFraction={0.25} illuminationPercent={25} />,
    );
    expect(container.querySelector('g[transform*="scale(-1 1)"] path.moon-lit-face')).toBeTruthy();
  });

  it("renders no lit path for non-finite illumination fraction", () => {
    const { container } = render(
      <MoonPhase cycleFraction={0.3} illuminationFraction={Number.NaN} />,
    );
    expect(container.querySelector(".moon-lit-face")).toBeFalsy();
  });
});
