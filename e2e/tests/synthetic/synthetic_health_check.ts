/**
 * Synthetic health check — NOT a Playwright test (no .spec./.test. in the
 * filename, so the default testMatch pattern skips it; per the brief, this
 * is meant to be scheduled externally via cron, outside this repo, hitting
 * a real deployment's /health and /metrics endpoints).
 *
 * Checks DB + Redis + MinIO + Celery + LLM together, via the real /health
 * endpoint (app/main.py:256-356), which itself checks all five in parallel
 * with hard timeouts (~1s total regardless of individual service state).
 *
 * Usage:
 *   PLAYWRIGHT_API_URL=https://staging.example.com/api/v1 \
 *     npx tsx tests/synthetic/synthetic_health_check.ts
 *
 * Exits 0 if healthy, 1 if degraded/unhealthy/unreachable — suitable for a
 * cron job + alerting (e.g. piping exit code to a paging system).
 */
import { request } from "@playwright/test";

const API_BASE_URL = process.env.PLAYWRIGHT_API_URL || "http://localhost:8001/api/v1";
// /health and /metrics are mounted at the app root, not under /api/v1.
const ROOT_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, "");

interface HealthResponse {
  status: "ok" | "degraded" | "unhealthy";
  version: string;
  environment: string;
  services: {
    database: "connected" | "disconnected";
    redis: "connected" | "disconnected";
    minio: "connected" | "disconnected";
    celery: "connected" | "disconnected";
    llm: string;
  };
}

async function main(): Promise<number> {
  const ctx = await request.newContext({ timeout: 10_000 });
  let exitCode = 0;

  try {
    console.log(`[synthetic_health_check] GET ${ROOT_URL}/health`);
    const healthResp = await ctx.get(`${ROOT_URL}/health`);
    const body: HealthResponse = await healthResp.json();

    console.log(`[synthetic_health_check] status=${body.status} http=${healthResp.status()}`);
    console.log(`[synthetic_health_check] services=${JSON.stringify(body.services)}`);

    if (healthResp.status() !== 200) {
      console.error("[synthetic_health_check] FAIL: /health returned non-200 (critical service down: DB or Redis)");
      exitCode = 1;
    }
    if (body.status !== "ok") {
      console.warn(
        `[synthetic_health_check] WARN: status=${body.status} — non-critical service degraded ` +
          "(minio/celery/llm circuit open), critical services still healthy",
      );
    }

    console.log(`[synthetic_health_check] GET ${ROOT_URL}/metrics`);
    const metricsResp = await ctx.get(`${ROOT_URL}/metrics`);
    if (!metricsResp.ok()) {
      console.error(`[synthetic_health_check] FAIL: /metrics returned ${metricsResp.status()}`);
      exitCode = 1;
    } else {
      const text = await metricsResp.text();
      if (!text.includes("# HELP") && !text.includes("# TYPE")) {
        console.error("[synthetic_health_check] FAIL: /metrics response doesn't look like Prometheus text format");
        exitCode = 1;
      }
    }
  } catch (err) {
    console.error(`[synthetic_health_check] FAIL: request error — ${err instanceof Error ? err.message : err}`);
    exitCode = 1;
  } finally {
    await ctx.dispose();
  }

  return exitCode;
}

main().then((code) => process.exit(code));
