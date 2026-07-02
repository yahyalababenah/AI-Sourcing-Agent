/**
 * Synthetic SSE uptime check — NOT a Playwright test (no .spec./.test. in
 * the filename; per the brief, meant to be scheduled/run externally,
 * observing a long-lived connection, particularly across a rolling restart).
 *
 * Opens a real SSE connection to /api/v1/notifications/stream and holds it
 * for the requested duration (default 10 minutes, per the brief), logging
 * whether it stays open and reporting any disconnect with a timestamp.
 *
 * IMPORTANT — this is expected to FAIL across a rolling restart today: SSE
 * delivery (app/shared/notifications.py) is plain in-process asyncio.Queue
 * state, not Redis-backed pub/sub (TESTING_FINDINGS.md finding #3). A
 * rolling restart kills the worker process holding the connection, and
 * there is no cross-process handoff — this script is intentionally built to
 * catch and clearly report that gap, not paper over it.
 *
 * Usage:
 *   PLAYWRIGHT_API_URL=https://staging.example.com/api/v1 \
 *   SYNTHETIC_SSE_TOKEN=<a valid JWT access token> \
 *   SYNTHETIC_SSE_DURATION_MS=600000 \
 *     npx tsx tests/synthetic/synthetic_sse_uptime.ts
 */

const API_BASE_URL = process.env.PLAYWRIGHT_API_URL || "http://localhost:8001/api/v1";
const TOKEN = process.env.SYNTHETIC_SSE_TOKEN;
const DURATION_MS = Number(process.env.SYNTHETIC_SSE_DURATION_MS || 10 * 60 * 1000);
const STALL_WARNING_MS = 60_000; // no bytes at all for 60s is worth logging, even if still "connected"

async function main(): Promise<number> {
  if (!TOKEN) {
    console.error(
      "[synthetic_sse_uptime] FAIL: SYNTHETIC_SSE_TOKEN env var required " +
        "(a valid access token — e.g. from a synthetic monitoring account)",
    );
    return 1;
  }

  const url = `${API_BASE_URL}/notifications/stream?token=${encodeURIComponent(TOKEN)}`;
  console.log(`[synthetic_sse_uptime] connecting to ${url.replace(TOKEN, "***")}`);
  console.log(`[synthetic_sse_uptime] holding connection for ${DURATION_MS / 1000}s`);

  const startedAt = Date.now();
  let lastByteAt = startedAt;
  let receivedConnectedPing = false;
  let disconnectedEarly = false;
  let disconnectReason = "";

  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(), DURATION_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok || !response.body) {
      console.error(`[synthetic_sse_uptime] FAIL: connection rejected, status=${response.status}`);
      return 1;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const stallChecker = setInterval(() => {
      const idleMs = Date.now() - lastByteAt;
      if (idleMs > STALL_WARNING_MS) {
        console.warn(
          `[synthetic_sse_uptime] WARN: no data received for ${Math.round(idleMs / 1000)}s ` +
            "(connection may be silently dead — SSE has no built-in heartbeat here)",
        );
      }
    }, STALL_WARNING_MS);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          disconnectedEarly = Date.now() - startedAt < DURATION_MS - 5_000;
          disconnectReason = "stream ended (server closed the connection)";
          break;
        }
        lastByteAt = Date.now();
        buffer += decoder.decode(value, { stream: true });
        if (buffer.includes("event: connected")) {
          if (!receivedConnectedPing) {
            console.log(`[synthetic_sse_uptime] received initial 'connected' event at t=0s`);
          }
          receivedConnectedPing = true;
        }
        buffer = buffer.slice(-1000); // don't grow unbounded over a long run
      }
    } finally {
      clearInterval(stallChecker);
    }
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.log(`[synthetic_sse_uptime] duration elapsed normally, connection was still open — closing`);
    } else {
      disconnectedEarly = Date.now() - startedAt < DURATION_MS - 5_000;
      disconnectReason = err instanceof Error ? err.message : String(err);
    }
  } finally {
    clearTimeout(timeoutTimer);
  }

  const totalUptimeS = Math.round((Date.now() - startedAt) / 1000);
  console.log(`[synthetic_sse_uptime] total connection uptime: ${totalUptimeS}s`);

  if (!receivedConnectedPing) {
    console.error("[synthetic_sse_uptime] FAIL: never received the initial 'connected' event");
    return 1;
  }
  if (disconnectedEarly) {
    console.error(
      `[synthetic_sse_uptime] FAIL: connection dropped early (after ${totalUptimeS}s, ` +
        `expected ~${DURATION_MS / 1000}s) — reason: ${disconnectReason}. ` +
        "If this coincided with a deploy/rolling restart, this is the expected, " +
        "known limitation documented in TESTING_FINDINGS.md — in-memory SSE state " +
        "doesn't survive a worker restart.",
    );
    return 1;
  }

  console.log("[synthetic_sse_uptime] PASS: connection held for the full duration");
  return 0;
}

main().then((code) => process.exit(code));
