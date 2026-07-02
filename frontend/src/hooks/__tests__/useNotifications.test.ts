import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useNotifications } from "../useNotifications";
import { useAuthStore } from "@/stores/authStore";
import { installMockEventSource, MockEventSource } from "@/test/mockEventSource";

describe("useNotifications", () => {
  let restoreEventSource: () => void;

  beforeEach(() => {
    restoreEventSource = installMockEventSource();
    useAuthStore.setState({ accessToken: "fake-token" });
  });

  afterEach(() => {
    restoreEventSource();
  });

  it("does not open a connection when there is no access token", () => {
    useAuthStore.setState({ accessToken: null });
    renderHook(() => useNotifications());
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("opens an EventSource connection to the notifications stream when a token exists", () => {
    renderHook(() => useNotifications());
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toContain("/notifications/stream");
    expect(MockEventSource.instances[0].url).toContain("token=fake-token");
  });

  it("adds a notification and updates unreadCount on new_rfq", () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      MockEventSource.instances[0].emit("new_rfq", {
        title: "طلب جديد", body: "تفاصيل الطلب", rfq_id: "rfq-1",
      });
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].type).toBe("new_rfq");
    expect(result.current.notifications[0].rfq_id).toBe("rfq-1");
    expect(result.current.notifications[0].read).toBe(false);
    expect(result.current.unreadCount).toBe(1);
  });

  it("adds a notification and updates unreadCount on quote_ready", () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      MockEventSource.instances[0].emit("quote_ready", {
        title: "عرض جاهز", body: "تم إعداد عرض السعر", quotation_id: "quote-1",
      });
    });

    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].type).toBe("quote_ready");
    expect(result.current.notifications[0].quotation_id).toBe("quote-1");
    expect(result.current.unreadCount).toBe(1);
  });

  it("ignores the initial 'connected' ping event", () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      MockEventSource.instances[0].emit("connected", { user_id: "u1" });
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it("silently ignores malformed (non-JSON) event data", () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      MockEventSource.instances[0].emit("new_rfq", "not-valid-json{{{");
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it("markAllRead() marks every notification as read", () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      MockEventSource.instances[0].emit("new_rfq", { title: "a", body: "b" });
      MockEventSource.instances[0].emit("quote_ready", { title: "c", body: "d" });
    });
    expect(result.current.unreadCount).toBe(2);

    act(() => {
      result.current.markAllRead();
    });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications.every((n) => n.read)).toBe(true);
  });

  it("clear() empties the notification list", () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      MockEventSource.instances[0].emit("new_rfq", { title: "a", body: "b" });
    });
    expect(result.current.notifications).toHaveLength(1);

    act(() => {
      result.current.clear();
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it("does not manually reconnect on error — relies on the browser's native EventSource auto-reconnect", () => {
    const { result } = renderHook(() => useNotifications());
    const instanceCountBefore = MockEventSource.instances.length;

    act(() => {
      MockEventSource.instances[0].emitError();
    });

    // No crash, and no manual second connection opened by the hook itself —
    // per app code, onerror is a no-op comment: "Browser auto-reconnects
    // EventSource — no manual retry needed." This test documents that
    // reliance rather than a custom retry loop existing in this hook.
    expect(MockEventSource.instances).toHaveLength(instanceCountBefore);
    expect(result.current.notifications).toHaveLength(0);
  });

  it("closes the EventSource connection on unmount", () => {
    const { unmount } = renderHook(() => useNotifications());
    const instance = MockEventSource.instances[0];
    expect(instance.readyState).toBe(1);

    unmount();

    expect(instance.readyState).toBe(2);
  });

  it("keeps only the last 50 notifications", () => {
    const { result } = renderHook(() => useNotifications());

    act(() => {
      for (let i = 0; i < 60; i++) {
        MockEventSource.instances[0].emit("new_rfq", { title: `n${i}`, body: "b", rfq_id: String(i) });
      }
    });

    expect(result.current.notifications).toHaveLength(50);
    // Most recent notification (rfq_id "59") should be first.
    expect(result.current.notifications[0].rfq_id).toBe("59");
  });
});
