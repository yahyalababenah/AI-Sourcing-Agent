import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { monitoringService } from "@/services/monitoringService";

// Base URL for direct fetch calls (health, pings) — strips /api/v1 suffix.
const API_BASE = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/api\/v1\/?$/, "");

export interface HealthData {
  status: "ok" | "degraded" | "unhealthy";
  version: string;
  environment: string;
  services: {
    database: string;
    redis: string;
    minio: string;
    celery: string;
    llm: string;
  };
}

export interface PingResult {
  label: string;
  endpoint: string;
  method: string;
  latency: number | null;
  status: number | null;
  ok: boolean;
  history: number[];
}

const REFRESH_INTERVAL = 30_000; // 30s
const MAX_HISTORY = 12;

const ENDPOINTS_TO_PING: Array<{
  label: string;
  endpoint: string;
  method: "GET" | "POST";
}> = [
  { label: "Health Check", endpoint: `${API_BASE}/health`, method: "GET" },
  { label: "Auth / Me", endpoint: `${API_BASE}/api/v1/auth/me`, method: "GET" },
  { label: "RFQs List", endpoint: `${API_BASE}/api/v1/intake/rfqs`, method: "GET" },
  { label: "Pricing Rules", endpoint: `${API_BASE}/api/v1/pricing/rules`, method: "GET" },
  { label: "Quotes List", endpoint: `${API_BASE}/api/v1/quotes`, method: "GET" },
  { label: "Chat Rooms", endpoint: `${API_BASE}/api/v1/chat/rooms`, method: "GET" },
  { label: "Catalog Products", endpoint: `${API_BASE}/api/v1/catalog/products`, method: "GET" },
  { label: "Admin Stats", endpoint: `${API_BASE}/api/v1/admin/stats`, method: "GET" },
];

// Shared data/ping logic for AdminMonitorPageDesktop/Mobile — same
// split-file pattern as every other admin/dashboard screen.
export function useAdminMonitorData() {
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [pings, setPings] = useState<PingResult[]>(() =>
    ENDPOINTS_TO_PING.map((ep) => ({
      ...ep,
      latency: null,
      status: null,
      ok: false,
      history: [],
    }))
  );
  const [pinging, setPinging] = useState(false);
  const pingRef = useRef(false);

  const {
    data: health,
    isLoading: healthLoading,
    refetch: refetchHealth,
  } = useQuery<HealthData>({
    queryKey: ["monitor", "health"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/health`);
      return r.json();
    },
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 10_000,
  });

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["monitor", "stats"],
    queryFn: () => monitoringService.getStats(),
    refetchInterval: REFRESH_INTERVAL,
    staleTime: 20_000,
    retry: false,
  });

  const runPings = useCallback(async () => {
    if (pingRef.current) return;
    pingRef.current = true;
    setPinging(true);

    const results = await Promise.all(
      ENDPOINTS_TO_PING.map(async (ep, idx) => {
        const t0 = performance.now();
        let latency: number | null = null;
        let status: number | null = null;
        let ok = false;
        try {
          const res = await fetch(ep.endpoint, {
            method: ep.method,
            headers: {
              Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}`,
              "Content-Type": "application/json",
            },
            signal: AbortSignal.timeout(8000),
          });
          latency = Math.round(performance.now() - t0);
          status = res.status;
          ok = res.status < 500;
        } catch {
          latency = null;
          status = null;
          ok = false;
        }

        return { idx, latency, status, ok };
      })
    );

    setPings((prev) =>
      prev.map((p, idx) => {
        const r = results.find((x) => x.idx === idx);
        if (!r) return p;
        const newHistory = [...p.history.slice(-(MAX_HISTORY - 1)), r.latency ?? 0];
        return { ...p, latency: r.latency, status: r.status, ok: r.ok, history: newHistory };
      })
    );

    setPinging(false);
    pingRef.current = false;
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    runPings();
    const id = setInterval(runPings, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [runPings]);

  const handleRefresh = () => {
    refetchHealth();
    refetchStats();
    runPings();
  };

  const services = health?.services;
  const llmStatus = services?.llm ?? "";
  const isCircuitOpen = llmStatus.startsWith("circuit_open");
  const llmProviders = llmStatus.replace(/^(configured|circuit_open):/, "").split(",").filter(Boolean);

  const pingsWithLatency = pings.filter((p) => p.latency !== null);
  const avgLatency = pingsWithLatency.reduce((a, p) => a + (p.latency ?? 0), 0) / Math.max(1, pingsWithLatency.length);
  const failedPings = pings.filter((p) => !p.ok && p.status !== null).length;

  return {
    health,
    healthLoading,
    stats,
    pings,
    pinging,
    lastRefresh,
    handleRefresh,
    services,
    isCircuitOpen,
    llmProviders,
    avgLatency,
    failedPings,
  };
}
