import { useEffect, useRef, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";

export interface AppNotification {
  id: string;
  type: "new_rfq" | "quote_ready" | string;
  title: string;
  body: string;
  rfq_id?: string;
  quotation_id?: string;
  read: boolean;
  receivedAt: Date;
}

const SSE_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1").replace(
  "/api/v1",
  ""
);

export function useNotifications() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const esRef = useRef<EventSource | null>(null);

  const addNotification = useCallback((event: Omit<AppNotification, "id" | "read" | "receivedAt">) => {
    setNotifications((prev) => [
      {
        ...event,
        id: crypto.randomUUID(),
        read: false,
        receivedAt: new Date(),
      },
      ...prev.slice(0, 49), // keep last 50
    ]);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clear = useCallback(() => setNotifications([]), []);

  useEffect(() => {
    if (!accessToken) return;

    const url = `${SSE_BASE}/api/v1/notifications/stream?token=${encodeURIComponent(accessToken)}`;
    const es = new EventSource(url);
    esRef.current = es;

    const handleEvent = (e: MessageEvent, type: string) => {
      try {
        const data = JSON.parse(e.data) as Record<string, unknown>;
        if (type === "connected") return; // initial ping, ignore
        addNotification({
          type,
          title: (data.title as string) || "إشعار",
          body: (data.body as string) || "",
          rfq_id: data.rfq_id as string | undefined,
          quotation_id: data.quotation_id as string | undefined,
        });
      } catch {
        // malformed event — ignore
      }
    };

    es.addEventListener("new_rfq", (e) => handleEvent(e as MessageEvent, "new_rfq"));
    es.addEventListener("quote_ready", (e) => handleEvent(e as MessageEvent, "quote_ready"));
    es.addEventListener("connected", (e) => handleEvent(e as MessageEvent, "connected"));

    es.onerror = () => {
      // Browser auto-reconnects EventSource — no manual retry needed
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [accessToken, addNotification]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, markAllRead, clear };
}
