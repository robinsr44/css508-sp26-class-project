import { expect, test } from "@playwright/test";

const COMPUTE_BUDGET_MS = Number(process.env.PERF_COMPUTE_BUDGET_MS ?? 10_000);
const INTERACTIVE_BUDGET_MS = Number(process.env.PERF_INTERACTIVE_BUDGET_MS ?? 5_000);

/**
 * Browser-side performance budgets (specialized testing).
 * Requires live moon-api on 8080 and Vite dev proxy (default Playwright setup).
 */
test.describe("specialized performance", () => {
  test("main UI is interactive within budget after load", async ({ page }) => {
    const start = Date.now();
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /moon tracker/i })).toBeVisible();
    const compute = page.getByRole("button", { name: /^compute$/i });
    await expect(compute).toBeVisible();
    await compute.focus();

    const elapsed = Date.now() - start;
    expect(elapsed, `interactive UI took ${elapsed}ms`).toBeLessThanOrEqual(INTERACTIVE_BUDGET_MS);
  });

  test("compute shows moon results within budget", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel(/latitude/i).fill("47.6062");
    await page.getByLabel(/longitude/i).fill("-122.3321");
    await page.getByRole("group", { name: "Time entry" }).getByRole("button", { name: /^UTC$/i }).click();
    await page.getByLabel(/^date(\s*\(local\)|\s*\(UTC\))?$/i).fill("2026-04-05");
    await page.getByLabel(/^time(\s*\(local\)|\s*\(UTC\))?$/i).fill("12:00");

    const start = Date.now();
    await page.getByRole("button", { name: /compute/i }).click();
    await expect(page.getByRole("heading", { name: /^phase$/i })).toBeVisible();
    await expect(page.locator(".moon-phase-svg")).toBeVisible();
    await expect(page.getByRole("heading", { name: /^sun position$/i })).toBeVisible();

    const elapsed = Date.now() - start;
    expect(elapsed, `compute flow took ${elapsed}ms`).toBeLessThanOrEqual(COMPUTE_BUDGET_MS);
  });
});
