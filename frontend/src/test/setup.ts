import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./msw/server";

// jsdom doesn't implement scrollIntoView — polyfill it so components that
// call it (e.g. auto-scrolling chat/message lists) don't crash in tests.
Element.prototype.scrollIntoView = vi.fn();

// jsdom doesn't implement matchMedia — polyfill it so components using
// useMediaQuery (e.g. desktop/mobile screen switchers) don't crash in
// tests. Defaults to "no match" (mobile-first); tests needing the desktop
// branch can override matches per-query with vi.spyOn(window, "matchMedia").
window.matchMedia ??= vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
