import { expect, test } from "@playwright/test";

/**
 * Keyboard focus path: tab through primary controls and submit with Enter.
 * Color-contrast remains out of scope (see accessibility.spec.ts).
 */
test.describe("keyboard navigation", () => {
  test("can reach Compute via Tab and submit with Enter after filling the form", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel(/latitude/i).fill("47.6062");
    await page.getByLabel(/longitude/i).fill("-122.3321");
    await page.getByLabel(/^date$/i).fill("2026-04-05");
    await page.getByLabel(/^time \(utc\)$/i).fill("12:00");

    const compute = page.getByRole("button", { name: /^compute$/i });
    await compute.focus();
    await expect(compute).toBeFocused();

    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { name: /^phase$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^local$/i })).toBeVisible();

    await page.getByRole("button", { name: /^utc$/i }).focus();
    await expect(page.getByRole("button", { name: /^utc$/i })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: /^sun position$/i }).locator("..").getByText(/^UTC\s*:/i)).toBeVisible();
  });
});
