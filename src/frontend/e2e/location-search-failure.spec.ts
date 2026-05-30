import { expect, test } from "@playwright/test";

test.describe("location search failure paths", () => {
  test("shows no-results message when Nominatim returns an empty list", async ({ page }) => {
    await page.route("**/nominatim.openstreetmap.org/search**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/");
    await page.getByPlaceholder(/city/i).fill("Nonexistent Place 999");
    await page.getByRole("button", { name: /^search$/i }).click();

    await expect(page.getByText(/No results found for/i)).toBeVisible();
  });

  test("shows search-failed message when Nominatim returns HTTP 503", async ({ page }) => {
    await page.route("**/nominatim.openstreetmap.org/search**", async (route) => {
      await route.fulfill({ status: 503, body: "unavailable" });
    });

    await page.goto("/");
    await page.getByPlaceholder(/city/i).fill("Paris");
    await page.getByRole("button", { name: /^search$/i }).click();

    await expect(
      page.getByText(/Search failed\. Check your connection or enter coordinates directly/i),
    ).toBeVisible();
  });
});
