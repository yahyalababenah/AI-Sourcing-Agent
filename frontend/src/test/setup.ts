import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./msw/server";

// jsdom doesn't implement scrollIntoView — polyfill it so components that
// call it (e.g. auto-scrolling chat/message lists) don't crash in tests.
Element.prototype.scrollIntoView = vi.fn();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
