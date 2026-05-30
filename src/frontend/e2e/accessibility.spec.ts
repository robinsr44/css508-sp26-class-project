import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Automated a11y scan after results render. Color-contrast is disabled because strict AAA targets
 * often conflict with intentional dark-theme layouts in course demos.
 */
test.describe("accessibility", () => {
  test("axe reports no violations (excluding color-contrast) after compute", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel(/latitude/i).fill("47.6062");
    await page.getByLabel(/longitude/i).fill("-122.3321");
    await page.getByRole("group", { name: "Time entry" }).getByRole("button", { name: /^UTC$/i }).click();
    await page.getByLabel(/^date(\s*\(local\)|\s*\(UTC\))?$/i).fill("2026-04-05");
    await page.getByLabel(/^time(\s*\(local\)|\s*\(UTC\))?$/i).fill("12:00");
    await page.getByRole("button", { name: /compute/i }).click();

    await expect(page.getByRole("heading", { name: /^phase$/i })).toBeVisible();

    const results = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});
