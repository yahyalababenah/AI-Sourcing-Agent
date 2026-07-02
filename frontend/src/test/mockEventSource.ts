type Listener = (event: MessageEvent) => void;

/** Minimal EventSource stand-in that lets tests fire SSE events manually. */
export class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  readyState = 0;
  onerror: ((ev: Event) => void) | null = null;
  onopen: ((ev: Event) => void) | null = null;
  private listeners = new Map<string, Set<Listener>>();

  constructor(url: string) {
    this.url = url;
    this.readyState = 1;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  close() {
    this.readyState = 2;
  }

  /** Test helper: dispatch a named SSE event with a JSON-serializable payload. */
  emit(type: string, data: unknown) {
    const event = new MessageEvent(type, {
      data: typeof data === "string" ? data : JSON.stringify(data),
    });
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }

  /** Test helper: simulate a connection drop. */
  emitError() {
    this.readyState = 0;
    this.onerror?.(new Event("error"));
  }
}

/** Install the mock globally; returns a cleanup function to restore the real EventSource. */
export function installMockEventSource() {
  const original = globalThis.EventSource;
  MockEventSource.instances = [];
  // @ts-expect-error -- test-only stand-in, not a full EventSource implementation
  globalThis.EventSource = MockEventSource;
  return () => {
    globalThis.EventSource = original;
    MockEventSource.instances = [];
  };
}
