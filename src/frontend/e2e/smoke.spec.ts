import { expect, test } from "@playwright/test";

/**
 * Live stack: Vite (via playwright webServer) + moon-api on 8080.
 */
test.describe("moon tracker smoke", () => {
  test("compute shows moon phase, SVG disk, and sun position", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /moon tracker/i })).toBeVisible();

    await page.getByLabel(/latitude/i).fill("47.6062");
    await page.getByLabel(/longitude/i).fill("-122.3321");
    await page.getByRole("group", { name: "Time entry" }).getByRole("button", { name: /^UTC$/i }).click();
    await page.getByLabel(/^date(\s*\(local\)|\s*\(UTC\))?$/i).fill("2026-04-05");
    await page.getByLabel(/^time(\s*\(local\)|\s*\(UTC\))?$/i).fill("12:00");

    await page.getByRole("button", { name: /compute/i }).click();

    await expect(page.getByRole("heading", { name: /^phase$/i })).toBeVisible();
    await expect(page.locator(".moon-phase-svg")).toBeVisible();

    await expect(page.getByRole("heading", { name: /^sun position$/i })).toBeVisible();

    const illum = page.getByRole("heading", { name: /^illumination$/i }).locator("..");
    const timeDisplay = page.getByRole("group", { name: "Time display" });

    // UTC time entry shares the display toggle, so results start in UTC until Local is chosen.
    await expect(illum.getByText(/^UTC\s*:/i)).toBeVisible();

    await timeDisplay.getByRole("button", { name: /^local$/i }).click();
    await expect(illum.getByText(/Local time\s*:/i)).toBeVisible();

    await timeDisplay.getByRole("button", { name: /^UTC$/ }).click();
    await expect(illum.getByText(/^UTC\s*:/i)).toBeVisible();

    const visibility = page.getByRole("heading", { name: /^visibility$/i }).locator("..");
    await expect(visibility).toBeVisible();
    const hasRiseSet =
      (await visibility.getByText(/^Moonrise/i).count()) > 0 ||
      (await visibility.getByText(/^Moonset/i).count()) > 0;
    const hasPolarCopy =
      (await visibility.getByText(/above the horizon all day/i).count()) > 0 ||
      (await visibility.getByText(/below the horizon all day/i).count()) > 0;
    const hasHoursLine =
      (await visibility.getByText(/Above the horizon for/i).count()) > 0;
    expect(hasRiseSet || hasPolarCopy || hasHoursLine).toBe(true);

    const sun = page.getByRole("heading", { name: /^sun position$/i }).locator("..");
    await expect(sun.getByText(/^UTC\s*:/i)).toBeVisible();
    if (hasRiseSet) {
      await expect(visibility.getByText(/^Moonrise \(UTC\)/i)).toBeVisible();
    }
  });

  test("location search fills coordinates when Nominatim returns a hit", async ({ page }) => {
    await page.goto("/");

    await page.route("**/nominatim.openstreetmap.org/search**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { lat: "48.8566", lon: "2.3522", display_name: "Paris, France" },
        ]),
      });
    });

    await page.getByPlaceholder(/city/i).fill("Paris");
    await page.getByRole("button", { name: /^search$/i }).click();

    await expect(page.getByLabel(/latitude/i)).toHaveValue("48.8566");
    await expect(page.getByLabel(/longitude/i)).toHaveValue("2.3522");
  });
});
