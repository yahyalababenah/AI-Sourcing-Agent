import type { HttpHandler } from "msw";

/**
 * Per-endpoint MSW handlers, added to as component tests are written.
 * Import and append to this array (or use `server.use(...)` per-test for overrides).
 */
export const handlers: HttpHandler[] = [];
