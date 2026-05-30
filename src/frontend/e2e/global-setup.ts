const healthUrl =
  process.env.MOON_API_HEALTH_URL ?? "http://127.0.0.1:8080/api/health";

export default async function globalSetup() {
  const deadline = Date.now() + 15_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(healthUrl);
      if (!res.ok) throw new Error(`health HTTP ${res.status}`);
      const body = (await res.json()) as { status?: string };
      if (body.status !== "ok") {
        throw new Error(`unexpected health body: ${JSON.stringify(body)}`);
      }
      return;
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(
    `moon-api not healthy at ${healthUrl} before Playwright run: ${lastError}`,
  );
}
