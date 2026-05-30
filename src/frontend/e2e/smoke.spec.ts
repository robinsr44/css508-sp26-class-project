import { expect, test } from "@playwright/test";

const LAT = "47.6062";
const LON = "-122.3321";
const DATE = "2026-04-05";
const TIME = "12:00";

async function compute(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /moon tracker/i })).toBeVisible();
  await page.getByLabel(/latitude/i).fill(LAT);
  await page.getByLabel(/longitude/i).fill(LON);
  await page.getByLabel(/^date$/i).fill(DATE);
  await page.getByLabel(/time \(utc\)/i).fill(TIME);
  await page.getByRole("button", { name: /^compute$/i }).click();
}

test.describe("moon tracker smoke (E2E-01)", () => {
  test("compute shows phase, visibility, and sun with local and UTC labels", async ({ page }) => {
    await compute(page);

    await expect(page.getByRole("heading", { name: /^phase$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^visibility$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /sun position/i })).toBeVisible();

    await expect(page.getByText(/Moonrise \(local\)/i)).toBeVisible();
    await expect(page.getByText(/Moonset \(local\)/i)).toBeVisible();
    await expect(page.getByText(/UTC: moonrise/i)).toBeVisible();
    await expect(page.getByText(/Instant \(local\)/i).first()).toBeVisible();
    await expect(page.getByText(/Instant \(UTC\):/i).first()).toBeVisible();
  });
});
