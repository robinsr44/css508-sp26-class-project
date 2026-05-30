import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const LAT = "47.6062";
const LON = "-122.3321";
const DATE = "2026-04-05";
const TIME = "12:00";

test.describe("accessibility (E2E-03)", () => {
  test("axe reports no violations after compute", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel(/latitude/i).fill(LAT);
    await page.getByLabel(/longitude/i).fill(LON);
    await page.getByLabel(/^date$/i).fill(DATE);
    await page.getByLabel(/time \(utc\)/i).fill(TIME);
    await page.getByRole("button", { name: /^compute$/i }).click();

    await expect(page.getByRole("heading", { name: /^phase$/i })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test("compute button submits on Enter when focused", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel(/latitude/i).fill(LAT);
    await page.getByLabel(/longitude/i).fill(LON);
    await page.getByLabel(/^date$/i).fill(DATE);
    await page.getByLabel(/time \(utc\)/i).fill(TIME);

    await page.getByRole("button", { name: /^compute$/i }).focus();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { name: /^phase$/i })).toBeVisible({ timeout: 15_000 });
  });
});
