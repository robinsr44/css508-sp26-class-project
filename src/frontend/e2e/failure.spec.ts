import { expect, test } from "@playwright/test";

/**
 * Error UI when moon compute fails (stubbed API; moon-api health gate still passes in global-setup).
 */
test.describe("moon tracker failure paths", () => {
  test("shows alert when /api/moon returns 400", async ({ page }) => {
    await page.route("**/api/moon**", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "invalid date for e2e" }),
      });
    });

    await page.goto("/");

    await page.getByLabel(/latitude/i).fill("47.6062");
    await page.getByLabel(/longitude/i).fill("-122.3321");
    await page.getByLabel(/^date$/i).fill("2026-04-05");
    await page.getByLabel(/^time \(utc\)$/i).fill("12:00");

    await page.getByRole("button", { name: /compute/i }).click();

    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/invalid date for e2e/i);
    await expect(page.getByRole("heading", { name: /^phase$/i })).toHaveCount(0);
  });
});
