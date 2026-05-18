/**
 * Ensures moon-api is reachable before Playwright starts browser tests (Vite proxies `/api` to it).
 */
async function globalSetup(): Promise<void> {
  const url = process.env.MOON_API_HEALTH_URL ?? "http://127.0.0.1:8080/api/health";
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const body = (await res.json()) as { status?: string };
    if (body.status !== "ok") {
      throw new Error(`unexpected health body: ${JSON.stringify(body)}`);
    }
  } catch (err) {
    const hint =
      err instanceof Error && err.name === "AbortError"
        ? "timeout"
        : err instanceof Error
          ? err.message
          : String(err);
    throw new Error(
      `Playwright global-setup: moon-api health check failed (${hint}). URL=${url}. ` +
        `Start moon-api on port 8080 (see README), then rerun npm run test:e2e.`,
    );
  } finally {
    clearTimeout(t);
  }
}

export default globalSetup;
